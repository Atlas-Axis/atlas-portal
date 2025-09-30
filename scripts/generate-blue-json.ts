// #!/usr/bin/env npx tsx
// /**
//  * Generate Blue-style hierarchical Atlas JSON from Supabase
//  *
//  * - Builds hierarchy strictly from child_* relationship arrays (never uses parent_notion_page_id)
//  * - Starts from Scopes only (excludes Agent Scope Database entirely)
//  * - Mirrors .debug-data/blue.json shape and field names
//  * - Populates *_doc_no using generated numbers from ATLAS_DOCUMENT_NUMBERING_RULES
//  *
//  * NOTES & IMPORTANT DESIGN CHOICES
//  * - Exclusions:
//  *   - Entire `Agent Scope Database` is excluded from generation.
//  *   - Inactive documents are included by default here; use the filter scripts to remove them (see USAGE below).
//  * - Hierarchy source of truth:
//  *   - We NEVER use `parent_notion_page_id` to build the tree. Only per-type child_* arrays are used.
//  *   - Top-level roots are Scopes that do not appear as a child in any other Scope's `child_scope_ids`.
//  * - Primary docs under Sections:
//  *   - `section_primary_docs` contains Core and Active Data Controller nodes. Core nodes can nest Core and Type Specification children.
//  * - Type Specification handling:
//  *   - Type Specifications appear under a Core's `core_children` when linked via `child_section_and_primary_doc_ids`.
//  *   - Type Specification nodes include their own annotations, tenets, and needed research from their child_* arrays.
//  * - Active Data Controller handling:
//  *   - Controllers appear as entries in `section_primary_docs`. When encountered as children of a Core, we emit them as leaf controller nodes with empty arrays to mirror Blue JSON's contract.
//  *   - We do not currently expand `active_data_controller_active_data` from the `Active Data` DB; it is emitted as an empty array.
//  * - Annotations at Section level:
//  *   - `section_annotations` is only emitted when non-empty to match reference Blue JSON behavior.
//  * - Sorting & numbering:
//  *   - Siblings are ordered by `sort_order` when available; ties or missing values are broken by rules-based document numbers.
//  *   - Document numbers are generated across all loaded pages first, then used for *_doc_no fields and tie-breaking.
//  * - Dates:
//  *   - This script outputs the *_last_modified fields as stored. To reduce diff noise, run the date strip script noted below.
//  * - Limitations / gotchas:
//  *   - If a page is missing from child_* arrays in Supabase, it will not appear in the hierarchy even if it has a parent_notion_page_id.
//  *   - Empty arrays are emitted for some fields (e.g., `core_annotations`, `core_children`) to match the Blue JSON contract; some arrays (e.g., `section_annotations`) are omitted when empty.
//  *
//  * USAGE:
//  *   npx tsx scripts/generate-blue-json.ts
//  *
//  *   After running, run:
//  *   npx tsx scripts/atlas-json/filter-blue-json-inactive-docs.ts .debug-data/blue.json .debug-data/atlas-json-generated/blue-without-inactive.json
//  *   npx tsx scripts/atlas-json/strip-blue-json-last-modified.ts
//  *
//  * WHAT IT DOES:
//  * - Loads Atlas documents from Supabase
//  * - Generates hierarchical JSON with Scopes → Articles → Sections → Primary Docs (Cores)
//  * - Attaches related Annotations, Tenets (with Scenarios → Variations), and Needed Research under Cores
//  * - Sorts siblings using natural document-number ordering
//  *
//  * OUTPUT:
//  * - Writes .debug-data/blue-from-supabase.json
//  */
// import { mkdir, writeFile } from 'fs/promises';
// import path from 'path';
// import type { NotionDatabasePage } from '@/app/server/database/notion-database-page';
// import { ATLAS_DATABASES, AtlasDatabaseName } from '@/app/server/atlas/constants';
// import { loadAtlasFromSupabaseWithNestingAgentsUnderSection } from '@/app/server/atlas/load-atlas-from-supabase';
// import { generateDocumentNumbers } from './atlas-json/document-numbering';
// import { compareDocNumbers } from '@/app/server/atlas/atlas-utils';
// import { loadEnv } from './utils/load-env';

// const DEBUG_LOGGING = Boolean(Number(process.env.DEBUG_LOGGING));

// // Resolve output path (assumes running from repository root)
// const REPO_ROOT = process.cwd();
// const OUTPUT_DIR = path.join(REPO_ROOT, '.debug-data', 'atlas-json-generated');
// const OUTPUT_FILE = path.join(OUTPUT_DIR, 'blue-from-supabase.json');

// type Id = string;

// function idsFromJsonb(value: unknown): string[] {
//   if (!value) return [];
//   if (Array.isArray(value)) return value.filter((v) => typeof v === 'string') as string[];
//   try {
//     const parsed = JSON.parse(String(value));
//     return Array.isArray(parsed) ? (parsed.filter((v) => typeof v === 'string') as string[]) : [];
//   } catch {
//     return [];
//   }
// }

// function mapById(pages: NotionDatabasePage[]): Record<Id, NotionDatabasePage> {
//   return Object.fromEntries(pages.map((p) => [p.notion_page_id, p]));
// }

// function getGeneratedNumber(id: string, generated: Map<string, string>, fallback: string | null | undefined): string {
//   return generated.get(id) || fallback || '';
// }

// // Deprecated: prefer sortByOrderThenGenerated which uses sort_order then doc number tie-breaker
// // function sortByGenerated<T extends { id: string; fallbackDoc?: string }>(
// //   items: T[],
// //   generated: Map<string, string>,
// // ): T[] {
// //   return [...items].sort((a, b) =>
// //     compareDocNumbers(
// //       getGeneratedNumber(a.id, generated, a.fallbackDoc),
// //       getGeneratedNumber(b.id, generated, b.fallbackDoc),
// //     ),
// //   );
// // }

// function sortByOrderThenGenerated<T extends { id: string; fallbackDoc?: string; sortOrder?: number | null }>(
//   items: T[],
//   generated: Map<string, string>,
// ): T[] {
//   const withOrder = [...items];
//   return withOrder.sort((a, b) => {
//     const ao = a.sortOrder;
//     const bo = b.sortOrder;
//     const aMissing = ao == null;
//     const bMissing = bo == null;
//     if (!aMissing && !bMissing) {
//       if (ao! < bo!) return -1;
//       if (ao! > bo!) return 1;
//     } else if (!aMissing && bMissing) {
//       return -1; // present comes before missing
//     } else if (aMissing && !bMissing) {
//       return 1;
//     }
//     // tie-breaker by generated/original doc number
//     return compareDocNumbers(
//       getGeneratedNumber(a.id, generated, a.fallbackDoc),
//       getGeneratedNumber(b.id, generated, b.fallbackDoc),
//     );
//   });
// }

// // Core (Primary Doc)
// type CoreNode = {
//   core_name: string;
//   core_content: string;
//   core_last_modified: string;
//   core_uuid: string;
//   inactive: number;
//   core_doc_no: string;
//   core_children: (CoreNode | TypeSpecificationNode | ActiveDataControllerNode)[];
//   core_annotations: {
//     annotation_name: string;
//     annotation_content: string;
//     annotation_last_modified: string;
//     annotation_uuid: string;
//     inactive: number;
//     annotation_doc_no: string;
//   }[];
//   core_tenets: ReturnType<typeof buildTenetNode>[];
//   core_needed_research: {
//     needed_research_name: string;
//     needed_research_content: string;
//     needed_research_last_modified: string;
//     needed_research_uuid: string;
//     inactive: number;
//     needed_research_doc_no: string;
//   }[];
// };

// type ActiveDataControllerNode = {
//   active_data_controller_name: string;
//   active_data_controller_content: string;
//   active_data_controller_last_modified: string;
//   active_data_controller_uuid: string;
//   inactive: number;
//   active_data_controller_doc_no: string;
//   active_data_controller_active_data: unknown[];
//   active_data_controller_annotations: unknown[];
//   active_data_controller_tenets: unknown[];
//   active_data_controller_needed_research: unknown[];
// };

// type TypeSpecificationNode = {
//   type_specification_name: string;
//   type_specification_content: string;
//   type_specification_last_modified: string;
//   type_specification_uuid: string;
//   inactive: number;
//   type_specification_doc_no: string;
//   type_specification_doc_identifier_rules?: string | null;
//   type_specification_additional_logic?: string | null;
//   type_specification_type_category?: string | null;
//   type_specification_type_name?: string | null;
//   type_specification_type_overview?: string | null;
//   type_specification_components?: string | null;
//   type_specification_annotations: {
//     annotation_name: string;
//     annotation_content: string;
//     annotation_last_modified: string;
//     annotation_uuid: string;
//     inactive: number;
//     annotation_doc_no: string;
//   }[];
//   type_specification_tenets: ReturnType<typeof buildTenetNode>[];
//   type_specification_needed_research: {
//     needed_research_name: string;
//     needed_research_content: string;
//     needed_research_last_modified: string;
//     needed_research_uuid: string;
//     inactive: number;
//     needed_research_doc_no: string;
//   }[];
// };

// function getExtraStringField(obj: unknown, key: string): string | null {
//   if (!obj || typeof obj !== 'object') return null;
//   const anyObj = obj as Record<string, unknown>;
//   const value = anyObj[key];
//   if (typeof value === 'string') return value;
//   return value == null ? null : String(value);
// }

// function buildTypeSpecificationNode(
//   typeSpec: NotionDatabasePage,
//   generated: Map<string, string>,
//   lookups: Lookups,
// ): TypeSpecificationNode {
//   // Related children via child arrays on the Type Specification itself
//   const annotationIds = idsFromJsonb(typeSpec.child_annotation_ids);
//   const annotations = annotationIds.map((id) => lookups.annotations[id]).filter(Boolean) as NotionDatabasePage[];
//   const tenetIds = idsFromJsonb(typeSpec.child_tenet_ids);
//   const tenets = tenetIds.map((id) => lookups.tenets[id]).filter(Boolean) as NotionDatabasePage[];
//   const neededResearchIds = idsFromJsonb(typeSpec.child_needed_research_ids);
//   const neededResearch = neededResearchIds
//     .map((id) => lookups.neededResearch[id])
//     .filter(Boolean) as NotionDatabasePage[];

//   const type_specification_annotations = sortByOrderThenGenerated(
//     annotations.map((a) => ({
//       id: a.notion_page_id,
//       fallbackDoc: a.atlas_document_number,
//       sortOrder: a.sort_order ?? null,
//     })),
//     generated,
//   ).map(({ id }) => {
//     const a = lookups.annotations[id];
//     return {
//       annotation_name: a.plain_text_name ?? '',
//       annotation_content: a.plain_text_content ?? '',
//       annotation_last_modified: a.updated_at,
//       annotation_uuid: a.notion_page_id,
//       inactive: a.archived || a.in_trash ? 1 : 0,
//       annotation_doc_no: getGeneratedNumber(a.notion_page_id, generated, a.atlas_document_number),
//     };
//   });

//   const type_specification_tenets = sortByOrderThenGenerated(
//     tenets.map((t) => ({
//       id: t.notion_page_id,
//       fallbackDoc: t.atlas_document_number,
//       sortOrder: t.sort_order ?? null,
//     })),
//     generated,
//   ).map(({ id }) => buildTenetNode(lookups.tenets[id], generated, lookups));

//   const type_specification_needed_research = sortByOrderThenGenerated(
//     neededResearch.map((n) => ({
//       id: n.notion_page_id,
//       fallbackDoc: n.atlas_document_number,
//       sortOrder: n.sort_order ?? null,
//     })),
//     generated,
//   ).map(({ id }) => {
//     const n = lookups.neededResearch[id];
//     return {
//       needed_research_name: n.plain_text_name ?? '',
//       needed_research_content: n.plain_text_content ?? '',
//       needed_research_last_modified: n.updated_at,
//       needed_research_uuid: n.notion_page_id,
//       inactive: n.archived || n.in_trash ? 1 : 0,
//       needed_research_doc_no: getGeneratedNumber(n.notion_page_id, generated, n.atlas_document_number),
//     };
//   });

//   return {
//     type_specification_name: typeSpec.plain_text_name ?? '',
//     type_specification_content: typeSpec.plain_text_content ?? '',
//     type_specification_last_modified: typeSpec.updated_at,
//     type_specification_uuid: typeSpec.notion_page_id,
//     inactive: typeSpec.archived || typeSpec.in_trash ? 1 : 0,
//     type_specification_doc_no: getGeneratedNumber(typeSpec.notion_page_id, generated, typeSpec.atlas_document_number),
//     type_specification_doc_identifier_rules: getExtraStringField(typeSpec.extra_fields, 'doc_identifier_rules'),
//     type_specification_additional_logic: getExtraStringField(typeSpec.extra_fields, 'additional_logic'),
//     type_specification_type_category: getExtraStringField(typeSpec.extra_fields, 'type_category'),
//     type_specification_type_name: getExtraStringField(typeSpec.extra_fields, 'type_name'),
//     type_specification_type_overview: getExtraStringField(typeSpec.extra_fields, 'type_overview'),
//     type_specification_components: getExtraStringField(typeSpec.extra_fields, 'components'),
//     type_specification_annotations,
//     type_specification_tenets,
//     type_specification_needed_research,
//   };
// }

// function buildCoreNode(core: NotionDatabasePage, generated: Map<string, string>, lookups: Lookups): CoreNode {
//   // Related children via child arrays
//   const childIds = idsFromJsonb(core.child_section_and_primary_doc_ids);
//   const childPages = childIds
//     .map((id) => lookups.sectionsAndPrimaryDocs[id])
//     .filter((p): p is NotionDatabasePage => Boolean(p));
//   const coreChildren = childPages.filter((p) => p.atlas_document_type === 'Core');
//   const typeSpecChildren = childPages.filter((p) => p.atlas_document_type === 'Type Specification');

//   // Annotations, Tenets, Needed Research
//   const annotationIds = idsFromJsonb(core.child_annotation_ids);
//   const annotations = annotationIds.map((id) => lookups.annotations[id]).filter(Boolean) as NotionDatabasePage[];

//   const tenetIds = idsFromJsonb(core.child_tenet_ids);
//   const tenets = tenetIds.map((id) => lookups.tenets[id]).filter(Boolean) as NotionDatabasePage[];

//   const neededResearchIds = idsFromJsonb(core.child_needed_research_ids);
//   const neededResearch = neededResearchIds
//     .map((id) => lookups.neededResearch[id])
//     .filter(Boolean) as NotionDatabasePage[];

//   // Build child nodes
//   const core_children: (CoreNode | TypeSpecificationNode | ActiveDataControllerNode)[] = sortByOrderThenGenerated(
//     [...coreChildren, ...typeSpecChildren].map((c) => ({
//       id: c.notion_page_id,
//       fallbackDoc: c.atlas_document_number,
//       sortOrder: c.sort_order ?? null,
//     })),
//     generated,
//   ).map(({ id }) => {
//     const child = lookups.sectionsAndPrimaryDocs[id];
//     if (child.atlas_document_type === 'Core') {
//       return buildCoreNode(child, generated, lookups);
//     }
//     // Type Specification
//     if (child.atlas_document_type === 'Type Specification') {
//       return buildTypeSpecificationNode(child, generated, lookups);
//     }
//     // Active Data Controller node with empty arrays to mirror Blue JSON contract
//     const controller: ActiveDataControllerNode = {
//       active_data_controller_name: child.plain_text_name ?? '',
//       active_data_controller_content: child.plain_text_content ?? '',
//       active_data_controller_last_modified: child.updated_at,
//       active_data_controller_uuid: child.notion_page_id,
//       inactive: child.archived || child.in_trash ? 1 : 0,
//       active_data_controller_doc_no: getGeneratedNumber(child.notion_page_id, generated, child.atlas_document_number),
//       active_data_controller_active_data: [],
//       active_data_controller_annotations: [],
//       active_data_controller_tenets: [],
//       active_data_controller_needed_research: [],
//     };
//     return controller;
//   });

//   const core_annotations = sortByOrderThenGenerated(
//     annotations.map((a) => ({
//       id: a.notion_page_id,
//       fallbackDoc: a.atlas_document_number,
//       sortOrder: a.sort_order ?? null,
//     })),
//     generated,
//   ).map(({ id }) => {
//     const a = lookups.annotations[id];
//     return {
//       annotation_name: a.plain_text_name ?? '',
//       annotation_content: a.plain_text_content ?? '',
//       annotation_last_modified: a.updated_at,
//       annotation_uuid: a.notion_page_id,
//       inactive: a.archived || a.in_trash ? 1 : 0,
//       annotation_doc_no: getGeneratedNumber(a.notion_page_id, generated, a.atlas_document_number),
//     };
//   });

//   const core_tenets = sortByOrderThenGenerated(
//     tenets.map((t) => ({
//       id: t.notion_page_id,
//       fallbackDoc: t.atlas_document_number,
//       sortOrder: t.sort_order ?? null,
//     })),
//     generated,
//   ).map(({ id }) => buildTenetNode(lookups.tenets[id], generated, lookups));

//   const core_needed_research = sortByOrderThenGenerated(
//     neededResearch.map((n) => ({
//       id: n.notion_page_id,
//       fallbackDoc: n.atlas_document_number,
//       sortOrder: n.sort_order ?? null,
//     })),
//     generated,
//   ).map(({ id }) => {
//     const n = lookups.neededResearch[id];
//     return {
//       needed_research_name: n.plain_text_name ?? '',
//       needed_research_content: n.plain_text_content ?? '',
//       needed_research_last_modified: n.updated_at,
//       needed_research_uuid: n.notion_page_id,
//       inactive: n.archived || n.in_trash ? 1 : 0,
//       needed_research_doc_no: getGeneratedNumber(n.notion_page_id, generated, n.atlas_document_number),
//     };
//   });

//   return {
//     core_name: core.plain_text_name ?? '',
//     core_content: core.plain_text_content ?? '',
//     core_last_modified: core.updated_at,
//     core_uuid: core.notion_page_id,
//     inactive: core.archived || core.in_trash ? 1 : 0,
//     core_doc_no: getGeneratedNumber(core.notion_page_id, generated, core.atlas_document_number),
//     core_children,
//     core_annotations,
//     core_tenets,
//     core_needed_research,
//   };
// }

// // Tenet with Scenarios
// type TenetNode = {
//   tenet_name: string;
//   tenet_content: string;
//   tenet_last_modified: string;
//   tenet_uuid: string;
//   inactive: number;
//   tenet_doc_no: string;
//   tenet_scenarios: ScenarioNode[];
// };

// type ScenarioNode = {
//   scenario_name: string;
//   scenario_content: string;
//   scenario_last_modified: string;
//   scenario_uuid: string;
//   inactive: number;
//   scenario_doc_no: string;
//   scenario_variations: {
//     scenario_variation_name: string;
//     scenario_variation_content: string;
//     scenario_variation_last_modified: string;
//     scenario_variation_uuid: string;
//     inactive: number;
//     scenario_variation_doc_no: string;
//   }[];
// };

// function buildTenetNode(tenet: NotionDatabasePage, generated: Map<string, string>, lookups: Lookups): TenetNode {
//   const scenarioIds = idsFromJsonb(tenet.child_scenario_ids);
//   const scenarios = scenarioIds.map((id) => lookups.scenarios[id]).filter(Boolean) as NotionDatabasePage[];

//   const tenet_scenarios = sortByOrderThenGenerated(
//     scenarios.map((s) => ({
//       id: s.notion_page_id,
//       fallbackDoc: s.atlas_document_number,
//       sortOrder: s.sort_order ?? null,
//     })),
//     generated,
//   ).map(({ id }) => buildScenarioNode(lookups.scenarios[id], generated, lookups));

//   const node: TenetNode = {
//     tenet_name: tenet.plain_text_name ?? '',
//     tenet_content: tenet.plain_text_content ?? '',
//     tenet_last_modified: tenet.updated_at,
//     tenet_uuid: tenet.notion_page_id,
//     inactive: tenet.archived || tenet.in_trash ? 1 : 0,
//     tenet_doc_no: getGeneratedNumber(tenet.notion_page_id, generated, tenet.atlas_document_number),
//     tenet_scenarios,
//   };
//   return node;
// }

// // Scenario with Variations
// function buildScenarioNode(
//   scenario: NotionDatabasePage,
//   generated: Map<string, string>,
//   lookups: Lookups,
// ): ScenarioNode {
//   const variationIds = idsFromJsonb(scenario.child_scenario_variation_ids);
//   const variations = variationIds.map((id) => lookups.scenarioVariations[id]).filter(Boolean) as NotionDatabasePage[];

//   const scenario_variations = sortByOrderThenGenerated(
//     variations.map((v) => ({
//       id: v.notion_page_id,
//       fallbackDoc: v.atlas_document_number,
//       sortOrder: v.sort_order ?? null,
//     })),
//     generated,
//   ).map(({ id }) => {
//     const v = lookups.scenarioVariations[id];
//     return {
//       scenario_variation_name: v.plain_text_name ?? '',
//       scenario_variation_content: v.plain_text_content ?? '',
//       scenario_variation_last_modified: v.updated_at,
//       scenario_variation_uuid: v.notion_page_id,
//       inactive: v.archived || v.in_trash ? 1 : 0,
//       scenario_variation_doc_no: getGeneratedNumber(v.notion_page_id, generated, v.atlas_document_number),
//     };
//   });

//   const node: ScenarioNode = {
//     scenario_name: scenario.plain_text_name ?? '',
//     scenario_content: scenario.plain_text_content ?? '',
//     scenario_last_modified: scenario.updated_at,
//     scenario_uuid: scenario.notion_page_id,
//     inactive: scenario.archived || scenario.in_trash ? 1 : 0,
//     scenario_doc_no: getGeneratedNumber(scenario.notion_page_id, generated, scenario.atlas_document_number),
//     scenario_variations,
//   };
//   return node;
// }

// // Section with primary docs (Core only, mirroring blue.json strictly)
// function buildSectionNode(section: NotionDatabasePage, generated: Map<string, string>, lookups: Lookups) {
//   const childIds = idsFromJsonb(section.child_section_and_primary_doc_ids);
//   const children = childIds.map((id) => lookups.sectionsAndPrimaryDocs[id]).filter(Boolean) as NotionDatabasePage[];
//   const cores = children.filter((c) => c.atlas_document_type === 'Core');
//   const controllers = children.filter((c) => c.atlas_document_type === 'Active Data Controller');
//   const section_primary_docs = sortByOrderThenGenerated(
//     [...cores, ...controllers].map((c) => ({
//       id: c.notion_page_id,
//       fallbackDoc: c.atlas_document_number,
//       sortOrder: c.sort_order ?? null,
//     })),
//     generated,
//   ).map(({ id }) => {
//     const child = lookups.sectionsAndPrimaryDocs[id];
//     if (child.atlas_document_type === 'Core') {
//       return buildCoreNode(child, generated, lookups);
//     }
//     return {
//       active_data_controller_name: child.plain_text_name ?? '',
//       active_data_controller_content: child.plain_text_content ?? '',
//       active_data_controller_last_modified: child.updated_at,
//       active_data_controller_uuid: child.notion_page_id,
//       inactive: child.archived || child.in_trash ? 1 : 0,
//       active_data_controller_doc_no: getGeneratedNumber(child.notion_page_id, generated, child.atlas_document_number),
//     };
//   });

//   const sectionAnnotationIds = idsFromJsonb(section.child_annotation_ids);
//   const sectionAnnotations = sectionAnnotationIds
//     .map((id) => lookups.annotations[id])
//     .filter(Boolean) as NotionDatabasePage[];
//   const section_annotations = sortByOrderThenGenerated(
//     sectionAnnotations.map((a) => ({
//       id: a.notion_page_id,
//       fallbackDoc: a.atlas_document_number,
//       sortOrder: a.sort_order ?? null,
//     })),
//     generated,
//   ).map(({ id }) => {
//     const a = lookups.annotations[id];
//     return {
//       annotation_name: a.plain_text_name ?? '',
//       annotation_content: a.plain_text_content ?? '',
//       annotation_last_modified: a.updated_at,
//       annotation_uuid: a.notion_page_id,
//       inactive: a.archived || a.in_trash ? 1 : 0,
//       annotation_doc_no: getGeneratedNumber(a.notion_page_id, generated, a.atlas_document_number),
//     };
//   });

//   return {
//     section_name: section.plain_text_name ?? '',
//     section_content: section.plain_text_content ?? '',
//     section_last_modified: section.updated_at,
//     section_uuid: section.notion_page_id,
//     inactive: section.archived || section.in_trash ? 1 : 0,
//     section_doc_no: getGeneratedNumber(section.notion_page_id, generated, section.atlas_document_number),
//     section_primary_docs,
//     ...(section_annotations.length > 0 ? { section_annotations } : {}),
//   };
// }

// // Article with sections
// function buildArticleNode(article: NotionDatabasePage, generated: Map<string, string>, lookups: Lookups) {
//   const sectionIds = idsFromJsonb(article.child_section_and_primary_doc_ids);
//   const children = sectionIds.map((id) => lookups.sectionsAndPrimaryDocs[id]).filter(Boolean) as NotionDatabasePage[];
//   const sections = children.filter((c) => c.atlas_document_type === 'Section');
//   const article_sections = sortByOrderThenGenerated(
//     sections.map((s) => ({
//       id: s.notion_page_id,
//       fallbackDoc: s.atlas_document_number,
//       sortOrder: s.sort_order ?? null,
//     })),
//     generated,
//   ).map(({ id }) => buildSectionNode(lookups.sectionsAndPrimaryDocs[id], generated, lookups));

//   return {
//     article_name: article.plain_text_name ?? '',
//     article_content: article.plain_text_content ?? '',
//     article_last_modified: article.updated_at,
//     article_uuid: article.notion_page_id,
//     inactive: article.archived || article.in_trash ? 1 : 0,
//     article_doc_no: getGeneratedNumber(article.notion_page_id, generated, article.atlas_document_number),
//     article_sections,
//   };
// }

// // Scope with articles (top-level)
// function buildScopeNode(scope: NotionDatabasePage, generated: Map<string, string>, lookups: Lookups) {
//   const articleIds = idsFromJsonb(scope.child_article_ids);
//   const articles = articleIds.map((id) => lookups.articles[id]).filter(Boolean) as NotionDatabasePage[];
//   const scope_articles = sortByOrderThenGenerated(
//     articles.map((a) => ({
//       id: a.notion_page_id,
//       fallbackDoc: a.atlas_document_number,
//       sortOrder: a.sort_order ?? null,
//     })),
//     generated,
//   ).map(({ id }) => buildArticleNode(lookups.articles[id], generated, lookups));

//   return {
//     scope_name: scope.plain_text_name ?? '',
//     scope_content: scope.plain_text_content ?? '',
//     scope_last_modified: scope.updated_at,
//     scope_uuid: scope.notion_page_id,
//     inactive: scope.archived || scope.in_trash ? 1 : 0,
//     scope_doc_no: getGeneratedNumber(scope.notion_page_id, generated, scope.atlas_document_number),
//     scope_articles,
//   };
// }

// type Lookups = {
//   scopes: Record<Id, NotionDatabasePage>;
//   articles: Record<Id, NotionDatabasePage>;
//   sectionsAndPrimaryDocs: Record<Id, NotionDatabasePage>;
//   annotations: Record<Id, NotionDatabasePage>;
//   tenets: Record<Id, NotionDatabasePage>;
//   scenarios: Record<Id, NotionDatabasePage>;
//   scenarioVariations: Record<Id, NotionDatabasePage>;
//   neededResearch: Record<Id, NotionDatabasePage>;
// };

// export async function generateBlueJsonFromSupabase(): Promise<unknown[]> {
//   // Ensure env vars are loaded for Supabase client
//   loadEnv();
//   const atlas = await loadAtlasFromSupabaseWithNestingAgentsUnderSection();

//   // Exclude Agent Scope Database entirely
//   const scopes = (atlas[ATLAS_DATABASES.SCOPES] || []) as NotionDatabasePage[];
//   const articles = (atlas[ATLAS_DATABASES.ARTICLES] || []) as NotionDatabasePage[];
//   const sectionsAndPrimaryDocs = (atlas[ATLAS_DATABASES.SECTIONS_AND_PRIMARY_DOCS] || []) as NotionDatabasePage[];
//   const annotations = (atlas[ATLAS_DATABASES.ANNOTATIONS] || []) as NotionDatabasePage[];
//   const tenets = (atlas[ATLAS_DATABASES.TENETS] || []) as NotionDatabasePage[];
//   const scenarios = (atlas[ATLAS_DATABASES.SCENARIOS] || []) as NotionDatabasePage[];
//   const scenarioVariations = (atlas[ATLAS_DATABASES.SCENARIO_VARIATIONS] || []) as NotionDatabasePage[];
//   const neededResearch = (atlas[ATLAS_DATABASES.NEEDED_RESEARCH] || []) as NotionDatabasePage[];

//   const lookups: Lookups = {
//     scopes: mapById(scopes),
//     articles: mapById(articles),
//     sectionsAndPrimaryDocs: mapById(sectionsAndPrimaryDocs),
//     annotations: mapById(annotations),
//     tenets: mapById(tenets),
//     scenarios: mapById(scenarios),
//     scenarioVariations: mapById(scenarioVariations),
//     neededResearch: mapById(neededResearch),
//   };

//   // Generate document numbers for all pages, then use them in *_doc_no
//   if (DEBUG_LOGGING) console.log('Generating document numbers (rules-based)');
//   const generatedNumbers = generateDocumentNumbers({
//     [ATLAS_DATABASES.SCOPES]: scopes,
//     [ATLAS_DATABASES.ARTICLES]: articles,
//     [ATLAS_DATABASES.SECTIONS_AND_PRIMARY_DOCS]: sectionsAndPrimaryDocs,
//     [ATLAS_DATABASES.ANNOTATIONS]: annotations,
//     [ATLAS_DATABASES.TENETS]: tenets,
//     [ATLAS_DATABASES.SCENARIOS]: scenarios,
//     [ATLAS_DATABASES.SCENARIO_VARIATIONS]: scenarioVariations,
//     [ATLAS_DATABASES.ACTIVE_DATA]: atlas[ATLAS_DATABASES.ACTIVE_DATA] || [],
//     [ATLAS_DATABASES.AGENTS]: [], // excluded
//     [ATLAS_DATABASES.NEEDED_RESEARCH]: neededResearch,
//   } as Record<AtlasDatabaseName, NotionDatabasePage[]>);

//   const scopeList = Object.values(lookups.scopes);
//   // Only top-level Scopes (no parent via child_* lookup). We treat scopes with no other page listing them in child_scope_ids as roots.
//   const scopeHasParent = new Set<string>();
//   for (const p of scopeList) {
//     const childScopes = idsFromJsonb(p.child_scope_ids);
//     for (const id of childScopes) scopeHasParent.add(id);
//   }
//   const rootScopes = scopeList.filter((s) => !scopeHasParent.has(s.notion_page_id));

//   const result = sortByOrderThenGenerated(
//     rootScopes.map((s) => ({
//       id: s.notion_page_id,
//       fallbackDoc: s.atlas_document_number,
//       sortOrder: s.sort_order ?? null,
//     })),
//     generatedNumbers,
//   ).map(({ id }) => buildScopeNode(lookups.scopes[id], generatedNumbers, lookups));

//   await mkdir(OUTPUT_DIR, { recursive: true });
//   await writeFile(OUTPUT_FILE, JSON.stringify(result, null, 4), 'utf8');
//   if (DEBUG_LOGGING) console.log(`Wrote hierarchical Blue JSON to ${OUTPUT_FILE}`);
//   return result as unknown[];
// }

// // Main execution
// if (require.main === module) {
//   (async () => {
//     try {
//       console.log('Generating hierarchical blue-style JSON (Scopes only) from Supabase...');
//       const data = await generateBlueJsonFromSupabase();
//       console.log(`Done. Scopes: ${data.length}. Output: ${OUTPUT_FILE}`);
//     } catch (error) {
//       console.error('Failed to generate blue-style JSON:', error);
//       process.exit(1);
//     }
//   })();
// }
