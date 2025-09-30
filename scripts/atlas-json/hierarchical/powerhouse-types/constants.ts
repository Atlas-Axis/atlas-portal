import { type QueryDatabaseParameters } from "@notionhq/client/build/src/api-endpoints.js";
import { type PageName } from "./types/processed-data.js";

export const DEFAULT_OUTPUT_PATH = "data";
export const DEFAULT_ATLAS_DATA_URL =
  "https://sky-atlas.powerhouse.io"

export const MASTER_STATUS = "masterStatus";
export const ORIGINAL_CONTEXT_DATA = "originalContextData";
export const APPROVED = "Approved";
export const PROVISIONAL = "Provisional";
export const PLACEHOLDER = "Placeholder";
export const DEFERRED = "Deferred";
export const ARCHIVED = "Archived";
export const UNKNOWN = "unknown";
export const SCOPE = "scope";
export const ARTICLE = "article";
export const CORE = "core";
export const ACTIVE_DATA_CONTROLLER = "activeDataController";
export const SECTION = "section";
export const TYPE_SPECIFICATION = "typeSpecification";
export const CATEGORY = "category";
export const ANNOTATION = "annotation";
export const NEEDED_RESEARCH = "neededResearch";
export const SCENARIO = "scenario";
export const SCENARIO_VARIATION = "scenarioVariation";
export const TENET = "tenet";
export const ACTIVE_DATA = "activeData";
export const AGENT = "agent";
export const AGENT_ARTIFACT = "agentArtifact";
export const SKY_PRIMITIVE = "skyPrimitive";
export const GLOBAL_TAGS = "globalTags";

/**
 * Atlas page names
 * 
 * These are the names of the pages that are used in the Atlas Explorer.
 * 
 * Excluding the reference pages.
 */
export const atlasPageNames = [
  SCOPE,
  ARTICLE,
  SECTION,
  ANNOTATION,
  TENET,
  SCENARIO,
  SCENARIO_VARIATION,
  NEEDED_RESEARCH,
  ORIGINAL_CONTEXT_DATA,
  ACTIVE_DATA,
  AGENT,
  GLOBAL_TAGS,
] as const;

export const pageIds: Record<PageName, string> = {
  [SCOPE]: "ebdb403a44bd4d169ec8f9330e955247",
  [ARTICLE]: "15e06a0d07364458a5caeb85d7b54408",
  [SECTION]: "06d1d4fa1cc44e88a06559d4082163a8",
  [ANNOTATION]: "e147e8835a2143c38264e86b1d9b24fc",
  [TENET]: "7fcbad225c524dffa20cd4efb2e13b56",
  [SCENARIO]: "8a05694599194c3ca8c8ee1b86086837",
  [SCENARIO_VARIATION]: "d0de59236e6d4a48a44533fa64d966ac",
  [NEEDED_RESEARCH]: "effd5738033548a98ec1a7e99cbadd1d",
  [ORIGINAL_CONTEXT_DATA]: "e9f9f2a29abe4d5991495a148c755b41",
  [ACTIVE_DATA]: "5b566dd732464927b8eee6e1b2ff99d9",
  [AGENT]: "1bbf2ff08d73808d9ce3e2122857e262",
  [MASTER_STATUS]: "37f256facc7e40dfa045564ebb347b12",
  [GLOBAL_TAGS]: "b261507c03fc4f6387594dea3d08d692",
} as const;

export const apiKey = process.env.API_KEY;
export const importApiKey = process.env.IMPORT_API_KEY;
export const importApiUrl = process.env.IMPORT_API_URL;

export const archivedMasterStatusId = "434486e6-0d5e-4541-9f00-40cb9bd67d1c";
export const deferredMasterStatusId = "f38bf53d-96bd-4345-a403-c6629ed202a1";
export const approvedMasterStatusId = "fe75a64f-585b-4d08-af00-ef8667d9c307";
export const provisionalMasterStatusId = "3dbb9d9c-fd63-462b-99f3-1ce879f16768";
export const placeholderMasterStatusId = "3edf54e3-be0e-4bbb-b008-502cfc23394e";
export const agentArtifactsSectionId = "1b4f2ff0-8d73-8082-862b-dcd586862638";

export const masterStatusesIdMap: Record<string, string> = {
  [archivedMasterStatusId]: ARCHIVED,
  [deferredMasterStatusId]: DEFERRED,
  [approvedMasterStatusId]: APPROVED,
  [provisionalMasterStatusId]: PROVISIONAL,
  [placeholderMasterStatusId]: PLACEHOLDER,
};

export const allowedPageFieldTypes = [
  "title",
  "rich_text",
  "select",
  "relation",
  "number",
  "url",
  "files",
  "formula",
] as const;

export const notionDatabaseFilters: QueryDatabaseParameters["filter"] = {
  and: [
    {
      and: [
        {
          property: "Master Status",
          relation: {
            does_not_contain: deferredMasterStatusId,
          },
        },
        {
          property: "Master Status",
          relation: {
            does_not_contain: archivedMasterStatusId,
          },
        },
      ],
    },
    {
      or: [
        {
          property: "Master Status",
          relation: {
            contains: approvedMasterStatusId,
          },
        },
        {
          property: "Master Status",
          relation: {
            contains: provisionalMasterStatusId,
          },
        },
        {
          property: "Master Status",
          relation: {
            contains: placeholderMasterStatusId,
          },
        },
        {
          property: "Master Status",
          relation: {
            is_empty: true,
          },
        },
      ],
    },
  ],
};
