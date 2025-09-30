import { AtlasDocumentType } from '@/app/server/atlas/constants';

/** UUIDs of agent root documents whose subtrees can be omitted via --omit-agents */
export const AGENT_ROOT_UUIDS = new Set<string>([
  '1b4f2ff0-8d73-8082-862b-dcd586862638',
  '1b4f2ff0-8d73-802f-a054-fece4d8731a4',
]);

/**
 * A simplified, standardized representation of an Atlas document used for downstream processing.
 */
export interface StandardizedAtlasDocument {
  type: AtlasDocumentType | string; // Allow string for unknown/custom types
  docNo: string;
  name: string;
  uuid: string | null;

  // TODO: content

  // Children (recursive)
  scopes: StandardizedAtlasDocument[];
  articles: StandardizedAtlasDocument[];
  sectionsAndPrimaryDocs: StandardizedAtlasDocument[];
  annotations: StandardizedAtlasDocument[];
  tenets: StandardizedAtlasDocument[];
  scenarios: StandardizedAtlasDocument[];
  scenarioVariations: StandardizedAtlasDocument[];
  activeData: StandardizedAtlasDocument[];
  agentScopeDocs: StandardizedAtlasDocument[];
  neededResearch: StandardizedAtlasDocument[];
}

/** Root array of standardized Scope trees. */
export type StandardizedAtlasScopeTrees = StandardizedAtlasDocument[];
