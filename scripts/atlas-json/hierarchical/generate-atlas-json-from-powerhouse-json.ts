#!/usr/bin/env node
/**
 * CLI: Standardize Atlas Scope Trees from Powerhouse JSON
 *
 * Purpose
 * - Read Powerhouse-exported Atlas trees (ViewNode format) and convert them to
 *   `StandardizedAtlasDocument` trees where children are grouped by Atlas document type.
 * - Output is consumed by downstream tooling for diffs/exports.
 *
 * How it works
 * - Each Powerhouse node has a `type` (lowerCamelCase) and `subDocuments` (flat list).
 * - We map `type` → AtlasDocumentType (Title Case names) and recursively convert.
 * - Child `subDocuments` are filtered by mapped document type and assigned to the
 *   matching standardized child arrays (e.g., `coreDocuments`, `activeDataControllers`).
 * - Supporting documents are grouped under `supportingDocuments` where applicable.
 *
 * Input/Output
 * - Input: `.debug-data/atlas-raw-sources/atlas-explorer/atlas-data.json` (Powerhouse ViewNode[])
 * - Output: `.debug-data/standardized-atlas/atlas-powerhouse-standardized.json` (StandardizedAtlasDocument[])
 *
 * Run
 * ```bash
 * npx tsx scripts/atlas-json/hierarchical/generate-atlas-json-from-powerhouse-json.ts
 * ```
 */
import fs from 'fs';
import path from 'path';
import type { AtlasDocumentType } from '@/app/server/atlas/constants';
import { TDocType } from './powerhouse-types/types';
import type { ViewNode } from './powerhouse-types/types/view-nodes';
import { makeViewNodeAtlasId, makeViewNodeTitleText } from './powerhouse-types/utils';
import {
  type ActiveDataControllerDocument,
  type ActiveDataDocument,
  type AnnotationDocument,
  type ArticleDocument,
  type BaseAtlasDocument,
  type CategoryDocument,
  type CoreDocument,
  type NeededResearchDocument,
  type ScenarioDocument,
  type ScenarioVariationDocument,
  type SectionDocument,
  type StandardizedAtlasDocument,
  type StandardizedAtlasScopeTrees,
  type TenetDocument,
  type TypeSpecificationDocument,
} from './types';

type PowerhouseTreeNode = ViewNode;

// Map Powerhouse `type` (lowerCamelCase) to our AtlasDocumentType (Title Case)
const powerhouseTypeToAtlas: Record<Exclude<TDocType, 'originalContextData'>, AtlasDocumentType> = {
  scope: 'Scope',
  article: 'Article',
  section: 'Section',
  category: 'Category',
  core: 'Core',
  activeDataController: 'Active Data Controller',
  typeSpecification: 'Type Specification',
  annotation: 'Annotation',
  tenet: 'Action Tenet',
  scenario: 'Scenario',
  scenarioVariation: 'Scenario Variation',
  activeData: 'Active Data',
  neededResearch: 'Needed Research',
};

// Resolve Atlas document type from a Powerhouse node; error if unmapped
function atlasTypeFromPowerhouse(node: PowerhouseTreeNode): AtlasDocumentType {
  const mapped = powerhouseTypeToAtlas[node.type as keyof typeof powerhouseTypeToAtlas];
  if (!mapped) throw new Error(`Unknown Powerhouse node.type '${node.type}' for node ${node.id}`);
  return mapped;
}

// Convert core identity fields to standardized base document
function toBase(node: PowerhouseTreeNode): BaseAtlasDocument {
  return {
    type: atlasTypeFromPowerhouse(node),
    docNo: makeViewNodeAtlasId(node),
    name: makeViewNodeTitleText(node),
    uuid: node.id,
    content: '', // TODO
  };
}

// Utility: Filter Powerhouse `subDocuments` by a target Atlas document type and convert
function mapChildren<T extends StandardizedAtlasDocument>(
  node: PowerhouseTreeNode,
  expectedType: AtlasDocumentType,
): T[] {
  return node.subDocuments.filter((c) => atlasTypeFromPowerhouse(c) === expectedType).map((c) => convertNode(c) as T);
}

// Build `supportingDocuments` for Article
function mapSupportingForArticle(node: PowerhouseTreeNode): ArticleDocument['supportingDocuments'] {
  const result: NonNullable<ArticleDocument['supportingDocuments']> = {};
  const annotations = mapChildren<AnnotationDocument>(node, 'Annotation');
  const neededResearch = mapChildren<NeededResearchDocument>(node, 'Needed Research');
  const tenets = mapChildren<TenetDocument>(node, 'Action Tenet');
  if (annotations.length > 0) result.annotations = annotations;
  if (neededResearch.length > 0) result.neededResearch = neededResearch;
  if (tenets.length > 0) result.tenets = tenets;
  return Object.keys(result).length > 0 ? result : undefined;
}

// Build `supportingDocuments` for Section/Core/Type Specification
function mapSupportingForSectionCoreSpec(node: PowerhouseTreeNode): SectionDocument['supportingDocuments'] {
  const result: NonNullable<SectionDocument['supportingDocuments']> = {};
  const annotations = mapChildren<AnnotationDocument>(node, 'Annotation');
  const neededResearch = mapChildren<NeededResearchDocument>(node, 'Needed Research');
  const tenets = mapChildren<TenetDocument>(node, 'Action Tenet');
  if (annotations.length > 0) result.annotations = annotations;
  if (neededResearch.length > 0) result.neededResearch = neededResearch;
  if (tenets.length > 0) result.tenets = tenets;
  return Object.keys(result).length > 0 ? result : undefined;
}

// Build `supportingDocuments` for Active Data Controller (includes activeData)
function mapSupportingForADC(node: PowerhouseTreeNode): ActiveDataControllerDocument['supportingDocuments'] {
  const result: NonNullable<ActiveDataControllerDocument['supportingDocuments']> = {};
  const activeData = mapChildren<ActiveDataDocument>(node, 'Active Data');
  const annotations = mapChildren<AnnotationDocument>(node, 'Annotation');
  const neededResearch = mapChildren<NeededResearchDocument>(node, 'Needed Research');
  const tenets = mapChildren<TenetDocument>(node, 'Action Tenet');
  if (activeData.length > 0) result.activeData = activeData;
  if (annotations.length > 0) result.annotations = annotations;
  if (neededResearch.length > 0) result.neededResearch = neededResearch;
  if (tenets.length > 0) result.tenets = tenets;
  return Object.keys(result).length > 0 ? result : undefined;
}

// Recursively convert a Powerhouse node into a StandardizedAtlasDocument
function convertNode(node: PowerhouseTreeNode): StandardizedAtlasDocument {
  const base = toBase(node);
  const type = base.type;

  switch (type) {
    case 'Scope': {
      // Scope → has articles
      const doc: import('./types').ScopeDocument = { ...base, articles: [] };
      doc.articles = mapChildren<ArticleDocument>(node, 'Article');
      return doc;
    }
    case 'Article': {
      // Article → split subDocs into sections + categories; add supporting docs
      const doc: ArticleDocument = { ...base };
      const sections = mapChildren<SectionDocument>(node, 'Section');
      const categories = mapChildren<CategoryDocument>(node, 'Category');
      if (sections.length > 0) doc.sections = sections;
      if (categories.length > 0) doc.categories = categories;
      const supporting = mapSupportingForArticle(node);
      if (supporting) doc.supportingDocuments = supporting;
      return doc;
    }
    case 'Category': {
      // Category → no docNo; has sections
      const baseCategory: Omit<BaseAtlasDocument, 'docNo'> = {
        type: base.type,
        name: base.name,
        uuid: base.uuid,
        content: '',
      };
      const doc: CategoryDocument = { ...baseCategory, sections: [] };
      doc.sections = mapChildren<SectionDocument>(node, 'Section');
      return doc;
    }
    case 'Section': {
      // Section → split subDocs into primary doc groups; add supporting docs
      const doc: SectionDocument = { ...base };
      const coreDocs = mapChildren<CoreDocument>(node, 'Core');
      const adcs = mapChildren<ActiveDataControllerDocument>(node, 'Active Data Controller');
      const typeSpecs = mapChildren<TypeSpecificationDocument>(node, 'Type Specification');
      if (coreDocs.length > 0) doc.coreDocuments = coreDocs;
      if (adcs.length > 0) doc.activeDataControllers = adcs;
      if (typeSpecs.length > 0) doc.typeSpecifications = typeSpecs;
      const supporting = mapSupportingForSectionCoreSpec(node);
      if (supporting) doc.supportingDocuments = supporting;
      return doc;
    }
    case 'Core': {
      // Core → may contain nested Core/ADC/Type Spec; add supporting docs
      const doc: CoreDocument = { ...base };
      const coreDocs = mapChildren<CoreDocument>(node, 'Core');
      const adcs = mapChildren<ActiveDataControllerDocument>(node, 'Active Data Controller');
      const typeSpecs = mapChildren<TypeSpecificationDocument>(node, 'Type Specification');
      if (coreDocs.length > 0) doc.coreDocuments = coreDocs;
      if (adcs.length > 0) doc.activeDataControllers = adcs;
      if (typeSpecs.length > 0) doc.typeSpecifications = typeSpecs;
      const supporting = mapSupportingForSectionCoreSpec(node);
      if (supporting) doc.supportingDocuments = supporting;
      return doc;
    }
    case 'Active Data Controller': {
      // Active Data Controller → supporting docs include activeData
      const doc: ActiveDataControllerDocument = { ...base };
      const supporting = mapSupportingForADC(node);
      if (supporting) doc.supportingDocuments = supporting;
      return doc;
    }
    case 'Type Specification': {
      // Type Specification → supporting docs only
      const doc: TypeSpecificationDocument = { ...base };
      const supporting = mapSupportingForSectionCoreSpec(node);
      if (supporting) doc.supportingDocuments = supporting;
      return doc;
    }
    case 'Action Tenet': {
      // Tenet → has scenarios
      const doc: TenetDocument = { ...base };
      const scenarios = mapChildren<ScenarioDocument>(node, 'Scenario');
      if (scenarios.length > 0) doc.scenarios = scenarios;
      return doc;
    }
    case 'Scenario': {
      // Scenario → has scenario variations
      const doc: ScenarioDocument = { ...base, scenarioVariations: [] };
      const variations = mapChildren<ScenarioVariationDocument>(node, 'Scenario Variation');
      if (variations.length > 0) doc.scenarioVariations = variations;
      return doc;
    }
    case 'Annotation':
    case 'Active Data':
    case 'Scenario Variation':
    case 'Needed Research':
      // Leaf docs → base only
      return { ...base } as StandardizedAtlasDocument;
    default:
      return { ...base } as StandardizedAtlasDocument;
  }
}

// Entry: read Powerhouse JSON, convert to standardized trees, write output
async function main() {
  const inputDir = '.debug-data/atlas-raw-sources/atlas-explorer';
  const inputFile = path.join(inputDir, 'atlas-data.json');
  const outputDir = '.debug-data/standardized-atlas';
  const outputFile = path.join(outputDir, 'atlas-powerhouse-standardized.json');

  if (!fs.existsSync(inputFile)) {
    console.error(`Input file not found: ${inputFile}`);
    process.exit(1);
  }

  const raw = fs.readFileSync(inputFile, 'utf8');
  const scopeTrees: PowerhouseTreeNode[] = JSON.parse(raw);

  const standardizedTrees: StandardizedAtlasScopeTrees = scopeTrees.map((node) => convertNode(node));

  fs.mkdirSync(outputDir, { recursive: true });
  fs.writeFileSync(outputFile, JSON.stringify(standardizedTrees, null, 2), 'utf8');

  console.log(`Standardized ${standardizedTrees.length} root scope trees`);
  console.log(`Wrote standardized JSON to ${outputFile}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
