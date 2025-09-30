import fs from 'fs';
import path from 'path';
import { RawViewNode, ViewNode } from './powerhouse-types/types';
import { StandardizedAtlasDocument, StandardizedAtlasScopeTrees } from './types';

type PowerhouseTreeNode = ViewNode;

/**
 * Creates a title text for a view node
 */
function makeViewNodeTitleText(node: ViewNode | RawViewNode): string {
  const { formalId, title, typeSuffix } = node.title;
  const { prefix, numberPath } = formalId;
  const path = [prefix, ...numberPath].join('.');
  const typeSuffixString = typeSuffix ? ` - ${typeSuffix}` : '';

  return `${path} - ${title}${typeSuffixString}`;
}

/**
 * Creates an Atlas ID for a view node. This is the number that appears in the Atlas Explorer.
 */
function makeViewNodeAtlasId(node: ViewNode) {
  const { formalId } = node.title;
  const { prefix, numberPath } = formalId;
  return `${prefix}.${numberPath.join('.')}`;
}

function convertNode(node: PowerhouseTreeNode): StandardizedAtlasDocument {
  const standardized: StandardizedAtlasDocument = {
    type: node.type,
    docNo: makeViewNodeAtlasId(node),
    name: makeViewNodeTitleText(node),
    uuid: node.id,

    // TODO: content

    // Children (recursive)
    // TODO
    scopes: [],
    articles: [],
    sectionsAndPrimaryDocs: [],
    annotations: [],
    tenets: [],
    scenarios: [],
    scenarioVariations: [],
    activeData: [],
    agentScopeDocs: [],
    neededResearch: [],

    //   standardized.scopes = node.scopes.map((n) => convertNode(n, options));
    //   standardized.articles = node.articles.map((n) => convertNode(n, options));
    //   standardized.sectionsAndPrimaryDocs = node.sectionsAndPrimaryDocs.map((n) => convertNode(n, options));
    //   standardized.annotations = node.annotations.map((n) => convertNode(n, options));
    //   standardized.tenets = node.tenets.map((n) => convertNode(n, options));
    //   standardized.scenarios = node.scenarios.map((n) => convertNode(n, options));
    //   standardized.scenarioVariations = node.scenarioVariations.map((n) => convertNode(n, options));
    //   standardized.activeData = node.activeData.map((n) => convertNode(n, options));
    //   standardized.agentScopeDocs = node.agentScopeDocs.map((n) => convertNode(n, options));
    //   standardized.neededResearch = node.neededResearch.map((n) => convertNode(n, options));
  };

  // TODO

  return standardized;
}

/**
 * Entry point.
 * - Reads input JSON, standardizes, writes output JSON, prints summary stats.
 */
async function main() {
  const inputDir = '.debug-data/atlas-raw-sources/atlas-explorer';
  const inputFile = path.join(inputDir, 'atlas-data.json');
  const outputDir = '.debug-data/standardized-atlas';
  const outputFile = 'atlas-powerhouse-standardized.json';

  if (!fs.existsSync(inputFile)) {
    console.error(`Input file not found: ${inputFile}`);
    process.exit(1);
  }

  const raw = fs.readFileSync(inputFile, 'utf8');
  const scopeTrees: ViewNode[] = JSON.parse(raw);

  const standardizedTrees: StandardizedAtlasScopeTrees = scopeTrees.map((node) => convertNode(node));

  fs.mkdirSync(outputDir, { recursive: true });
  fs.writeFileSync(outputFile, JSON.stringify(standardizedTrees, null, 2), 'utf8');

  //   const totalDocs = countDocuments(standardizedTrees);
  console.log(`Standardized ${standardizedTrees.length} root scope trees`);
  //   console.log(`Total documents (including all descendants): ${totalDocs}`);
  console.log(`Wrote standardized JSON to ${outputFile}`);
}

// TODO: Implement
main().catch((err) => {
  console.error(err);
  process.exit(1);
});
