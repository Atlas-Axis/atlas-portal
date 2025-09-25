#!/usr/bin/env npx tsx
/**
 * Generic Blue JSON inactive filter.
 *
 * What it does:
 * - Reads a Blue-style hierarchical JSON file (top-level array of Scopes)
 * - Recursively removes any object that has `inactive: 1`
 *   - Applies to: scopes, articles, sections, cores, type specifications,
 *     active data controllers, annotations, tenets, scenarios, variations,
 *     and needed research
 * - Preserves order of remaining siblings and overall structure
 * - Writes the filtered hierarchy to the output file
 *
 * Notes:
 * - This script only filters by the `inactive` flag. It does not modify
 *   date fields or any other content. To normalize date noise, run:
 *     npx tsx scripts/atlas-json/strip-blue-json-last-modified.ts
 * - Input must be a top-level JSON array (the standard Blue JSON shape)
 * - Designed to be used for parity comparisons in conjunction with the
 *   generated Blue JSON from Supabase
 *
 * Usage:
 *   npx tsx scripts/atlas-json/filter-inactive-generic.ts <input.json> <output.json>
 */
import { readFile, writeFile } from 'fs/promises';
import path from 'path';

type AnyObject = Record<string, unknown>;

function isInactive(node: AnyObject | null | undefined): boolean {
  return Boolean(node && typeof node === 'object' && (node as AnyObject).inactive === 1);
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

function filterCore(node: AnyObject): AnyObject | null {
  if (isInactive(node)) return null;
  const copy: AnyObject = { ...node };
  const coreChildren = asArrayOfObjects(copy.core_children);
  if (coreChildren) copy.core_children = filterArray(coreChildren, (c) => filterCore(c));
  const coreAnnotations = asArrayOfObjects(copy.core_annotations);
  if (coreAnnotations) copy.core_annotations = filterArray(coreAnnotations, (a) => (isInactive(a) ? null : a));
  const coreNeeded = asArrayOfObjects(copy.core_needed_research);
  if (coreNeeded) copy.core_needed_research = filterArray(coreNeeded, (n) => (isInactive(n) ? null : n));
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
  return copy;
}

function filterTypeSpecification(node: AnyObject): AnyObject | null {
  if (isInactive(node)) return null;
  const copy: AnyObject = { ...node };
  const annotations = asArrayOfObjects(copy.type_specification_annotations);
  if (annotations) copy.type_specification_annotations = filterArray(annotations, (a) => (isInactive(a) ? null : a));
  const needed = asArrayOfObjects(copy.type_specification_needed_research);
  if (needed) copy.type_specification_needed_research = filterArray(needed, (n) => (isInactive(n) ? null : n));
  const tenets = asArrayOfObjects(copy.type_specification_tenets);
  if (tenets) {
    copy.type_specification_tenets = filterArray(tenets, (t) => {
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
  return copy;
}

function filterSectionPrimaryDoc(node: AnyObject): AnyObject | null {
  if (typeof node !== 'object' || node == null) return null;
  if ('core_name' in node) return filterCore(node);
  if ('type_specification_name' in node) return filterTypeSpecification(node);
  return isInactive(node) ? null : node;
}

function filterSection(node: AnyObject): AnyObject | null {
  if (isInactive(node)) return null;
  const copy: AnyObject = { ...node };
  const docs = asArrayOfObjects(copy.section_primary_docs);
  if (docs) copy.section_primary_docs = filterArray(docs, (pd) => filterSectionPrimaryDoc(pd));
  const annotations = asArrayOfObjects(copy.section_annotations);
  if (annotations) copy.section_annotations = filterArray(annotations, (a) => (isInactive(a) ? null : a));
  return copy;
}

function filterArticle(node: AnyObject): AnyObject | null {
  if (isInactive(node)) return null;
  const copy: AnyObject = { ...node };
  const sections = asArrayOfObjects(copy.article_sections);
  if (sections) copy.article_sections = filterArray(sections, (s) => filterSection(s));
  return copy;
}

function filterScope(node: AnyObject): AnyObject | null {
  if (isInactive(node)) return null;
  const copy: AnyObject = { ...node };
  const articles = asArrayOfObjects(copy.scope_articles);
  if (articles) copy.scope_articles = filterArray(articles, (a) => filterArticle(a));
  return copy;
}

async function main() {
  const [, , inputArg, outputArg] = process.argv;
  if (!inputArg || !outputArg) {
    console.error('Usage: npx tsx scripts/atlas-json/filter-inactive-generic.ts <input.json> <output.json>');
    process.exit(1);
  }
  const inputPath = path.resolve(process.cwd(), inputArg);
  const outputPath = path.resolve(process.cwd(), outputArg);
  const raw = await readFile(inputPath, 'utf8');
  const parsed = JSON.parse(raw);
  if (!Array.isArray(parsed)) {
    throw new Error('Input JSON must be a top-level array');
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
