"""compose_at_ref — read decomposed Atlas content at a git ref and recompose
the monolithic markdown that the rest of the renderer expects.

For any git ref the local clone can resolve, this module:

  1. Extracts the `content/` subtree at that ref into a temp directory using
     `git archive`.
  2. Runs the `compose()` function over that directory.
  3. Returns the recomposed monolith string.

Caching
-------
Composed output is cached keyed by (repo_path, resolved commit SHA). A
ref like `origin/main` resolves to a SHA before lookup; if the SHA is
already in cache, we return the cached string. The cache is an in-memory
LRU dict, scoped to the process; size defaults to 64 entries.
"""

from __future__ import annotations

import logging
import os
import subprocess
import tarfile
import tempfile
import threading
from collections import OrderedDict
from pathlib import Path
from typing import Optional

from .compose import compose

logger = logging.getLogger("atlas_preview.compose_at_ref")


# ---------------------------------------------------------------------------
# Cache (process-local, LRU)
# ---------------------------------------------------------------------------

class _LRUCache:
    """Tiny thread-safe LRU. Keys are (repo_path, commit_sha) tuples."""

    def __init__(self, max_size: int = 64) -> None:
        self._max_size = max_size
        self._data: "OrderedDict[tuple[str, str], str]" = OrderedDict()
        self._lock = threading.Lock()

    def get(self, key: tuple[str, str]) -> Optional[str]:
        with self._lock:
            if key not in self._data:
                return None
            # Move to end (MRU)
            self._data.move_to_end(key)
            return self._data[key]

    def put(self, key: tuple[str, str], value: str) -> None:
        with self._lock:
            self._data[key] = value
            self._data.move_to_end(key)
            while len(self._data) > self._max_size:
                self._data.popitem(last=False)

    def clear(self) -> None:
        with self._lock:
            self._data.clear()

    def __contains__(self, key: tuple[str, str]) -> bool:  # for tests
        with self._lock:
            return key in self._data

    def __len__(self) -> int:  # for tests
        with self._lock:
            return len(self._data)


_cache = _LRUCache(max_size=64)


def clear_cache() -> None:
    """Clear the process-local compose cache. Used by sync worker on
    detecting upstream changes, and by tests."""
    _cache.clear()


# ---------------------------------------------------------------------------
# Git extraction
# ---------------------------------------------------------------------------

def _resolve_sha(repo_path: str, ref: str) -> Optional[str]:
    """Resolve a ref to a 40-char commit SHA inside `repo_path`.

    Returns None if `repo_path` doesn't exist, isn't a git repo, or `ref`
    can't be resolved. Hardened against missing dirs and missing `git` so
    callers (and unit tests with non-existent fake repo paths) get a clean
    fall-through to the legacy code path.
    """
    if not os.path.isdir(repo_path):
        return None
    try:
        result = subprocess.run(
            ["git", "rev-parse", ref],
            capture_output=True, text=True,
            cwd=repo_path,
        )
    except (FileNotFoundError, NotADirectoryError):
        return None
    if result.returncode != 0:
        return None
    sha = result.stdout.strip()
    return sha or None


def _extract_content_at_ref(repo_path: str, ref: str, dest: str) -> bool:
    """Extract `content/` at `ref` from `repo_path` into `dest`.

    Uses `git archive --format=tar <ref> -- content/` piped to `tar -x` in
    `dest`. Returns True on success, False if the archive command failed
    (e.g. `content/` doesn't exist at this ref — which is the case for any
    ref *before* the decompose commit `7c459626`).
    """
    if not os.path.isdir(repo_path):
        return False
    try:
        archive_proc = subprocess.Popen(
            ["git", "archive", "--format=tar", ref, "--", "content"],
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            cwd=repo_path,
        )
    except (FileNotFoundError, NotADirectoryError):
        return False
    try:
        # Stream the tar into Python's tarfile rather than spawning `tar -x`
        # so we don't depend on a system tar binary.
        with tarfile.open(fileobj=archive_proc.stdout, mode="r|") as tf:
            tf.extractall(dest)
    except Exception:
        archive_proc.kill()
        archive_proc.wait()
        return False
    archive_proc.stdout.close()
    rc = archive_proc.wait()
    if rc != 0:
        # git archive emitted a non-zero exit — typically means content/
        # doesn't exist at this ref, or the ref doesn't exist.
        stderr = archive_proc.stderr.read().decode("utf-8", "replace")
        logger.debug("git archive failed for ref=%r: rc=%d stderr=%s",
                     ref, rc, stderr.strip())
        return False
    # Sanity check: did anything land in dest?
    content_root = os.path.join(dest, "content")
    if not os.path.isdir(content_root):
        return False
    return True


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

def compose_at_ref(ref: str, *, repo_path: str) -> Optional[str]:
    """Read the decomposed Atlas content at git `ref` and recompose to monolith.

    Args:
        ref:        Any git ref the local clone can resolve — branch name,
                    `origin/<branch>`, tag, commit SHA. The ref is resolved
                    to a 40-char SHA before any lookup.
        repo_path:  Path to the local clone.

    Returns:
        The recomposed monolithic Atlas markdown string. Returns None if the
        ref doesn't resolve, or if `content/` doesn't exist at that ref.

    The result is cached per (repo_path, commit_sha) — invalidates on SHA
    change. To force a recompute, call `clear_cache()` first.
    """
    repo_path = str(repo_path)

    sha = _resolve_sha(repo_path, ref)
    if sha is None:
        logger.debug("compose_at_ref: ref %r does not resolve in %s", ref, repo_path)
        return None

    cache_key = (repo_path, sha)
    cached = _cache.get(cache_key)
    if cached is not None:
        return cached

    with tempfile.TemporaryDirectory(prefix="atlas-compose-") as tmpdir:
        ok = _extract_content_at_ref(repo_path, sha, tmpdir)
        if not ok:
            return None
        content_root = os.path.join(tmpdir, "content")
        composed = compose(content_root)

    _cache.put(cache_key, composed)
    return composed


def compose_local(content_root: str | os.PathLike) -> str:
    """Compose from a `content/` directory on disk (no git involvement).

    Used for local dev / `atlas-preview` CLI watch mode against the working
    tree, where the user is editing files in their local clone directly.
    """
    return compose(str(content_root))
