#!/usr/bin/env npx tsx
/**
 * Filter Blue JSON to remove all inactive documents (and their subtrees).
 *
 * What it does:
 * - Loads .debug-data/blue.json (top-level array)
 * - Recursively removes any object with `inactive: 1` across scopes, articles, sections, cores, tenets, scenarios, variations, annotations, needed research
 * - Writes the filtered result to:
 *   .debug-data/atlas-json-generated/blue-without-inactive.json
 *
 * Usage:
 *   npx tsx scripts/filter-blue-json-inactive-docs.ts
 *
 * Notes:
 * - This is a structural filter only; it does not modify last-modified fields
 * - For stripping *_last_modified fields, run:
 *   npx tsx scripts/atlas-json/strip-blue-json-last-modified.ts
 */
import { readFile, writeFile } from 'fs/promises';
import path from 'path';

type AnyObject = Record<string, unknown>;

function isInactive(node: AnyObject | null | undefined): boolean {
  return Boolean(node && typeof node === 'object' && node.inactive === 1);
}

function filterArray<T extends object>(arr: T[] | undefined, filterItem: (n: T) => T | null): T[] {
  if (!Array.isArray(arr)) return [];
  const out: T[] = [];
  for (const item of arr) {
    const filtered = filterItem(item);
    if (filtered) out.push(filtered);
  }
  return out;
}

function asArrayOfObjects(value: unknown): AnyObject[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const onlyObjects = value.filter((v): v is AnyObject => Boolean(v) && typeof v === 'object');
  return onlyObjects as AnyObject[];
}

// Core and its nested structures
function filterCore(node: AnyObject): AnyObject | null {
  if (isInactive(node)) return null;
  const copy: AnyObject = { ...node };

  // core_children (cores)
  {
    const coreChildren = asArrayOfObjects(copy.core_children);
    if (coreChildren) {
      copy.core_children = filterArray(coreChildren, (c) => filterCore(c));
    }
  }

  // core_annotations (leaf)
  {
    const annotations = asArrayOfObjects(copy.core_annotations);
    if (annotations) {
      copy.core_annotations = filterArray(annotations, (a) => (isInactive(a) ? null : a));
    }
  }

  // core_needed_research (leaf)
  {
    const needed = asArrayOfObjects(copy.core_needed_research);
    if (needed) {
      copy.core_needed_research = filterArray(needed, (n) => (isInactive(n) ? null : n));
    }
  }

  // core_tenets → tenet_scenarios → scenario_variations
  {
    const tenets = asArrayOfObjects(copy.core_tenets);
    if (tenets) {
      copy.core_tenets = filterArray(tenets, (t) => {
        if (isInactive(t)) return null;
        const tCopy: AnyObject = { ...t };
        const scenarios = asArrayOfObjects(tCopy.tenet_scenarios);
        tCopy.tenet_scenarios = filterArray(scenarios, (s) => {
          if (isInactive(s)) return null;
          const sCopy: AnyObject = { ...s };
          const variations = asArrayOfObjects(sCopy.scenario_variations);
          sCopy.scenario_variations = filterArray(variations, (v) => (isInactive(v) ? null : v));
          return sCopy;
        });
        return tCopy;
      });
    }
  }

  return copy;
}

// Active Data Controller entries under section_primary_docs are leaf nodes; just filter by inactive
function filterSectionPrimaryDoc(node: AnyObject): AnyObject | null {
  // Distinguish Core vs Active Data Controller by presence of a known key
  if (typeof node !== 'object' || node == null) return null;
  if ('core_name' in node) return filterCore(node);
  // Active Data Controller shape
  return isInactive(node) ? null : node;
}

function filterSection(node: AnyObject): AnyObject | null {
  if (isInactive(node)) return null;
  const copy: AnyObject = { ...node };
  {
    const sectionDocs = asArrayOfObjects(copy.section_primary_docs);
    if (sectionDocs) {
      copy.section_primary_docs = filterArray(sectionDocs, (pd) => filterSectionPrimaryDoc(pd));
    }
  }
  {
    const sectionAnnotations = asArrayOfObjects(copy.section_annotations);
    if (sectionAnnotations) {
      copy.section_annotations = filterArray(sectionAnnotations, (a) => (isInactive(a) ? null : a));
    }
  }
  return copy;
}

function filterArticle(node: AnyObject): AnyObject | null {
  if (isInactive(node)) return null;
  const copy: AnyObject = { ...node };
  {
    const sections = asArrayOfObjects(copy.article_sections);
    if (sections) {
      copy.article_sections = filterArray(sections, (s) => filterSection(s));
    }
  }
  return copy;
}

function filterScope(node: AnyObject): AnyObject | null {
  if (isInactive(node)) return null;
  const copy: AnyObject = { ...node };
  {
    const articles = asArrayOfObjects(copy.scope_articles);
    if (articles) {
      copy.scope_articles = filterArray(articles, (a) => filterArticle(a));
    }
  }
  return copy;
}

async function main() {
  const repoRoot = process.cwd();
  const inputPath = path.join(repoRoot, '.debug-data', 'blue.json');
  const outputPath = path.join(repoRoot, '.debug-data', 'atlas-json-generated', 'blue-without-inactive.json');

  const raw = await readFile(inputPath, 'utf8');
  const parsed = JSON.parse(raw);
  if (!Array.isArray(parsed)) {
    throw new Error('Input .debug-data/blue.json must be a top-level array');
  }
  const data: AnyObject[] = parsed;
  const filtered = filterArray(data, (scope) => filterScope(scope));
  await writeFile(outputPath, JSON.stringify(filtered, null, 4), 'utf8');
  console.log(`Wrote filtered Blue JSON to ${outputPath}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
