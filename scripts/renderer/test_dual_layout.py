#!/usr/bin/env python3
"""Layer-1 parity tests for the vendored Python renderer, both Atlas layouts.

The TypeScript path has `compose.test.ts` + `atlas-source.test.ts`; this is the
equivalent floor for `scripts/renderer/`, which had no test coverage at all
before the de-atomization work. It proves the two claims the cutover rests on:

  1. `load_composed()` yields the identical monolith from an atomized `content/`
     tree and from a consolidated (Option C) directory.
  2. `walk_content_tree()` yields the identical `AtlasDoc` list from both — which
     is what `generate.py` feeds to `build_scope_data`, so the /proposal page is
     unchanged by the cutover.

Deliberately stdlib-only (`unittest`, not pytest) so it runs on any Python 3.11+
with no new dependency:

    python3 -m unittest discover -s scripts/renderer -p 'test_*.py'
"""

from __future__ import annotations

import dataclasses
import io
import os
import shutil
import sys
import tarfile
import tempfile
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))

from atlas_preview.atlas_source import (  # noqa: E402
    ATOMIZED,
    CONSOLIDATED,
    LayoutError,
    bucket_from_filename,
    detect_layout,
    load_composed,
    order_key,
    reassemble,
    resolve_atlas_root,
)
from atlas_preview.walk_content_tree import (  # noqa: E402
    walk_composed_markdown,
    walk_content_tree,
    walk_content_tree_from_tar_stream,
)

FIXTURES = Path(__file__).resolve().parents[2] / "tests" / "fixtures"
ATOMIZED_FIXTURE = str(FIXTURES / "atlas-content")
CONSOLIDATED_FIXTURE = str(FIXTURES / "atlas-content-consolidated")
EXPECTED_MONOLITH = FIXTURES / "atlas-content-expected.md"


def _tar_stream_of(root: str, prefix: str = "content") -> io.BytesIO:
    """Pack `root` into an in-memory tar rooted at `prefix/`."""
    buf = io.BytesIO()
    with tarfile.open(fileobj=buf, mode="w") as tf:
        tf.add(root, arcname=prefix)
    buf.seek(0)
    return buf


class TestDetectLayout(unittest.TestCase):
    def test_classifies_atomized_fixture(self):
        self.assertEqual(detect_layout(ATOMIZED_FIXTURE), ATOMIZED)

    def test_classifies_consolidated_fixture(self):
        self.assertEqual(detect_layout(CONSOLIDATED_FIXTURE), CONSOLIDATED)

    def test_neither_layout_raises_rather_than_composing_empty(self):
        # The regression this guards: an empty walk used to return [] / "" and be
        # read downstream as "pre-cutover ref", making a truncated checkout and a
        # valid old ref indistinguishable.
        with tempfile.TemporaryDirectory() as d:
            with self.assertRaisesRegex(LayoutError, "matches neither Atlas layout"):
                detect_layout(d)

    def test_both_layouts_raises(self):
        with tempfile.TemporaryDirectory() as d:
            os.makedirs(os.path.join(d, "A", "0"))
            Path(d, "A", "0", "document.md").write_text("x")
            Path(d, "A.0 - Atlas-Preamble.md").write_text("x")
            with self.assertRaisesRegex(LayoutError, "BOTH consolidated"):
                detect_layout(d)

    def test_not_a_directory_raises(self):
        with self.assertRaisesRegex(LayoutError, "is not a directory"):
            detect_layout(str(EXPECTED_MONOLITH))

    def test_non_bucket_md_files_are_not_a_layout(self):
        with tempfile.TemporaryDirectory() as d:
            Path(d, "README.md").write_text("x")
            Path(d, "_index.md").write_text("x")
            with self.assertRaisesRegex(LayoutError, "matches neither Atlas layout"):
                detect_layout(d)


class TestLoadComposedParity(unittest.TestCase):
    def setUp(self):
        self.expected = EXPECTED_MONOLITH.read_text(encoding="utf-8")

    def test_atomized_matches_expected_monolith(self):
        self.assertEqual(load_composed(ATOMIZED_FIXTURE), self.expected)

    def test_consolidated_matches_expected_monolith(self):
        self.assertEqual(load_composed(CONSOLIDATED_FIXTURE), self.expected)

    def test_layouts_are_byte_identical(self):
        self.assertEqual(
            load_composed(CONSOLIDATED_FIXTURE), load_composed(ATOMIZED_FIXTURE)
        )

    def test_resolves_a_repo_root_nesting_content(self):
        for fixture in (ATOMIZED_FIXTURE, CONSOLIDATED_FIXTURE):
            with tempfile.TemporaryDirectory() as d:
                shutil.copytree(fixture, os.path.join(d, "content"))
                self.assertEqual(resolve_atlas_root(d), os.path.join(d, "content"))
                self.assertEqual(load_composed(resolve_atlas_root(d)), self.expected)


class TestWalkContentTreeParity(unittest.TestCase):
    """The assertion the /proposal page rests on: same AtlasDocs, either layout."""

    def test_walk_produces_identical_atlas_docs(self):
        from_atoms = walk_content_tree(ATOMIZED_FIXTURE)
        from_buckets = walk_content_tree(CONSOLIDATED_FIXTURE)
        self.assertEqual(len(from_atoms), 10)
        self.assertEqual(
            [dataclasses.astuple(d) for d in from_buckets],
            [dataclasses.astuple(d) for d in from_atoms],
        )

    def test_every_doc_has_a_uuid_in_both_layouts(self):
        for root in (ATOMIZED_FIXTURE, CONSOLIDATED_FIXTURE):
            for doc in walk_content_tree(root):
                self.assertTrue(doc.uuid, f"{root}: {doc.number} has no uuid")

    def test_walk_raises_on_neither_layout(self):
        with tempfile.TemporaryDirectory() as d:
            with self.assertRaises(LayoutError):
                walk_content_tree(d)

    def test_heading_shaped_lines_in_code_fences_do_not_split_documents(self):
        # walk_content_tree deliberately diverges from parse_atlas(monolith) here:
        # a `# Constants` line inside a fenced snippet is body, not a document.
        # The consolidated splitter must preserve that divergence, which it does
        # by requiring the full compose() heading form including the UUID comment.
        text = (
            "# A.0 - Atlas Preamble [Scope]  <!-- UUID: u-1 -->\n"
            "\n"
            "```python\n"
            "# Constants\n"
            "## Not a heading either\n"
            "```\n"
            "\n"
            "## A.0.1 - Definitions [Article]  <!-- UUID: u-2 -->\n"
            "\n"
            "Body.\n"
        )
        docs = walk_composed_markdown(text)
        self.assertEqual([d.uuid for d in docs], ["u-1", "u-2"])
        self.assertIn("# Constants", docs[0].body)

    def test_splitter_handles_a_name_containing_brackets(self):
        text = '# A.0 - Defining [Severe Actions] [Scope]  <!-- UUID: u-1 -->\n\nBody.'
        docs = walk_composed_markdown(text)
        self.assertEqual(len(docs), 1)
        self.assertEqual(docs[0].name, "Defining [Severe Actions]")
        self.assertEqual(docs[0].doc_type, "Scope")


class TestTarStreamAdapter(unittest.TestCase):
    def test_both_layouts_stream_to_identical_atlas_docs(self):
        from_atoms = walk_content_tree_from_tar_stream(_tar_stream_of(ATOMIZED_FIXTURE))
        from_buckets = walk_content_tree_from_tar_stream(
            _tar_stream_of(CONSOLIDATED_FIXTURE)
        )
        self.assertEqual(
            [dataclasses.astuple(d) for d in from_buckets],
            [dataclasses.astuple(d) for d in from_atoms],
        )

    def test_stream_matches_the_filesystem_walk(self):
        self.assertEqual(
            [
                dataclasses.astuple(d)
                for d in walk_content_tree_from_tar_stream(
                    _tar_stream_of(CONSOLIDATED_FIXTURE)
                )
            ],
            [dataclasses.astuple(d) for d in walk_content_tree(CONSOLIDATED_FIXTURE)],
        )

    def test_empty_stream_raises_rather_than_returning_empty(self):
        with tempfile.TemporaryDirectory() as d:
            os.makedirs(os.path.join(d, "content"))
            buf = io.BytesIO()
            with tarfile.open(fileobj=buf, mode="w") as tf:
                tf.add(os.path.join(d, "content"), arcname="content")
            buf.seek(0)
            with self.assertRaisesRegex(LayoutError, "matches neither Atlas layout"):
                walk_content_tree_from_tar_stream(buf)


class TestBucketOrder(unittest.TestCase):
    def test_orders_by_integer_segments_not_filename(self):
        # ⛔ THE REGRESSION THIS EXISTS FOR. Lexicographically `A.6.1.1.10` sorts
        # between `.1` and `.2`. Sky expects to keep onboarding Stars, so the
        # tenth agent artifact would silently reorder ~2,000 documents with no
        # error raised anywhere if bucket order ever became a filename sort.
        buckets = ["A.6.1.1.10", "A.6.1.1.2", "A.6.1.1.1", "A.6.1.2", "A.6.1.1.9"]
        self.assertEqual(
            sorted(buckets, key=order_key),
            ["A.6.1.1.1", "A.6.1.1.2", "A.6.1.1.9", "A.6.1.1.10", "A.6.1.2"],
        )
        self.assertNotEqual(sorted(buckets), sorted(buckets, key=order_key))

    def test_prefix_sorts_before_its_extensions(self):
        self.assertEqual(
            sorted(["A.6.1.1.1", "A.6", "A.6.1", "A.6.1.1"], key=order_key),
            ["A.6", "A.6.1", "A.6.1.1", "A.6.1.1.1"],
        )

    def test_full_sixteen_bucket_partition(self):
        buckets = (
            [f"A.{i}" for i in range(7)]
            + [f"A.6.1.1.{i}" for i in range(1, 9)]
            + ["A.6.1.2"]
        )
        self.assertEqual(len(buckets), 16)
        self.assertEqual(sorted(reversed(buckets), key=order_key), buckets)

    def test_bucket_from_filename(self):
        self.assertEqual(bucket_from_filename("A.6.1.1.1 - Spark.md"), "A.6.1.1.1")
        self.assertEqual(bucket_from_filename("A.0 - Atlas-Preamble.md"), "A.0")
        for not_a_bucket in ("_index.md", "README.md", "document.md", "B.0 - X.md"):
            self.assertIsNone(bucket_from_filename(not_a_bucket))


class TestReassemble(unittest.TestCase):
    def test_duplicate_bucket_raises(self):
        with tempfile.TemporaryDirectory() as d:
            Path(d, "A.0 - Atlas-Preamble.md").write_text("x")
            Path(d, "A.0 - Atlas-Preamble-Copy.md").write_text("x")
            with self.assertRaisesRegex(LayoutError, "two files claim bucket"):
                reassemble(d)

    def test_no_buckets_raises(self):
        with tempfile.TemporaryDirectory() as d:
            with self.assertRaisesRegex(LayoutError, "no Atlas bucket files found"):
                reassemble(d)

    def test_concatenates_in_derived_order(self):
        with tempfile.TemporaryDirectory() as d:
            Path(d, "A.6.1.1.10 - Tenth.md").write_text("tenth")
            Path(d, "A.6.1.1.2 - Second.md").write_text("second")
            Path(d, "A.6.1.2 - Executors.md").write_text("executors")
            self.assertEqual(reassemble(d), "second\ntenth\nexecutors")


class TestConsolidatedFixtureShape(unittest.TestCase):
    def test_is_a_flat_directory_of_bucket_files(self):
        names = sorted(os.listdir(CONSOLIDATED_FIXTURE))
        self.assertEqual(
            names, ["A.0 - Atlas-Preamble.md", "A.1 - Foundational-Principles.md"]
        )

    def test_carries_no_index_files(self):
        # Option C retires the generated _index.md files entirely.
        self.assertNotIn("_index.md", os.listdir(CONSOLIDATED_FIXTURE))


if __name__ == "__main__":
    unittest.main()
