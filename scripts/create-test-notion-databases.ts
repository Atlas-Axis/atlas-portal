#!/usr/bin/env tsx
/**
 * Create Test Notion Databases Script
 *
 * This script creates test versions of all Atlas databases in Notion for safe testing
 * of Markdown→Notion sync automation. It reads configuration from:
 * - notion-database-properties-and-relationships.ts
 * - ATLAS_DATABASES constant
 * - NOTION_PROPERTY_TYPE_OVERRIDES
 *
 * All test databases are created under a specific parent page with the [TEST] prefix.
 *
 * Usage:
 *   npx tsx scripts/create-test-notion-databases.ts
 *   npx tsx scripts/create-test-notion-databases.ts --delete-existing
 *
 * The --delete-existing flag will archive existing test databases before creating new ones.
 */
import fs from 'fs';
import path from 'path';
import { AtlasDatabaseName, AtlasDocumentType } from '@/app/server/atlas/atlas-types';
import { ATLAS_DATABASES, ATLAS_DOCUMENT_TYPES } from '@/app/server/atlas/constants';
import {
  DOCUMENT_TYPE_EXTRA_FIELDS,
  NOTION_DATABASE_PROPERTIES_AND_RELATIONSHIPS,
  NOTION_PROPERTY_TYPE_OVERRIDES,
} from '@/app/server/atlas/notion-mapping/notion-database-properties-and-relationships';
import { notion } from '@/app/server/services/notion/notion-client';
import { Database, Json } from '@/app/server/services/supabase/database.types';
import { supabase } from '@/app/server/services/supabase/supabase-client';
import { loadEnv } from './utils/load-env';

// Type definitions for Notion database properties
// Using flexible types since we're directly interfacing with Notion API
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type NotionDatabaseProperties = Record<string, any>;

// Parent page ID for all test databases
const TEST_PARENT_PAGE_ID = '2a3f2ff08d7380ebb317dee36512b251';

// Database name prefix for test databases
const TEST_PREFIX = '[TEST]';

// Command-line argument parsing
const args = process.argv.slice(2);
const DELETE_EXISTING = args.includes('--delete-existing');

/**
 * Select field options for different properties across databases.
 * Extracted from production Atlas databases via analysis.
 */
const SELECT_FIELD_OPTIONS: Record<string, string[]> = {
  // Type field - populated per database from ATLAS_DOCUMENT_TYPES
  Type: Object.values(ATLAS_DOCUMENT_TYPES),

  // Type Category - only in Sections & Primary Docs
  'Type Category': ['Accessory Document', 'Immutable Document', 'Primary Document', 'Supporting Document'],

  // Active Data Controller fields - only in Sections & Primary Docs
  'Active Data Controller Responsible Party': [
    'Accessibility Facilitators',
    'Core GovOps',
    'Governance Facilitators',
    'Operational GovOps',
    'Support Facilitators',
    'Viridian Labs',
  ],
  'Active Data Controller Update Process': ['Alignment Conserver Changes', 'Direct Edit'],

  // Agent Scope Database fields
  'Agent Name': ['Grove', 'Launch Agent 2', 'Launch Agent 3', 'Launch Agent 4', 'Spark'],
  'Doc Type': ['Active Data Controller', 'Core'],

  // Workflow fields - used across multiple databases
  'Lead Review': [], // Empty options - workflow field
  'Proposal Status': ['Approved', 'Draft', 'Needs AA Review', 'Needs SH Review'],
};

/**
 * Mapping of document types that can appear in each database.
 * Used to filter Type field options per database.
 */
const DATABASE_DOCUMENT_TYPES: Record<AtlasDatabaseName, AtlasDocumentType[]> = {
  [ATLAS_DATABASES.SCOPES]: ['Scope'],
  [ATLAS_DATABASES.ARTICLES]: ['Article'],
  [ATLAS_DATABASES.SECTIONS_AND_PRIMARY_DOCS]: ['Section', 'Core', 'Type Specification', 'Active Data Controller'],
  [ATLAS_DATABASES.ANNOTATIONS]: ['Annotation'],
  [ATLAS_DATABASES.TENETS]: ['Action Tenet'],
  [ATLAS_DATABASES.SCENARIOS]: ['Scenario'],
  [ATLAS_DATABASES.SCENARIO_VARIATIONS]: ['Scenario Variation'],
  [ATLAS_DATABASES.ACTIVE_DATA]: ['Active Data'],
  [ATLAS_DATABASES.AGENTS]: ['Core', 'Active Data Controller'],
  [ATLAS_DATABASES.NEEDED_RESEARCH]: ['Needed Research'],
};

/**
 * Scope document data for creating root Scope documents.
 * Extracted from production Atlas databases (notion_database_pages_current).
 * These are required for the Atlas tree builder logic to function.
 */
interface ScopeDocumentData {
  atlas_document_uuid: string;
  atlas_document_number: string;
  plain_text_name: string;
  plain_text_content: string;
  json_name: Json;
  json_content: Json;
}

const SCOPE_DOCUMENTS_DATA: ScopeDocumentData[] = [
  {
    atlas_document_uuid: '8650a584-01f8-45d6-882b-c14eab9879c4',
    atlas_document_number: 'A.0',
    plain_text_name: 'Atlas Preamble',
    plain_text_content: 'This Preamble will be further populated in later iterations of the Atlas.',
    json_name: [
      {
        href: null,
        text: { link: null, content: 'Atlas Preamble' },
        type: 'text',
        plain_text: 'Atlas Preamble',
        annotations: {
          bold: false,
          code: false,
          color: 'default',
          italic: false,
          underline: false,
          strikethrough: false,
        },
      },
    ],
    json_content: [
      {
        href: null,
        text: { link: null, content: 'This Preamble will be further populated in later iterations of the Atlas.' },
        type: 'text',
        plain_text: 'This Preamble will be further populated in later iterations of the Atlas.',
        annotations: {
          bold: false,
          code: false,
          color: 'default',
          italic: false,
          underline: false,
          strikethrough: false,
        },
      },
    ],
  },
  {
    atlas_document_uuid: '18ac7dd3-c646-4352-9b0d-d01a2932d7d1',
    atlas_document_number: 'A.1',
    plain_text_name: 'The Governance Scope',
    plain_text_content:
      'The Governance Scope regulates the governance processes and balance of power of the Sky Ecosystem. The Governance Scope must ensure that the resilient equilibrium of Sky Governance remains protected against all potential direct and indirect threats.',
    json_name: [
      {
        href: null,
        text: { link: null, content: 'The Governance Scope' },
        type: 'text',
        plain_text: 'The Governance Scope',
        annotations: {
          bold: false,
          code: false,
          color: 'default',
          italic: false,
          underline: false,
          strikethrough: false,
        },
      },
    ],
    json_content: [
      {
        href: null,
        text: {
          link: null,
          content:
            'The Governance Scope regulates the governance processes and balance of power of the Sky Ecosystem. The Governance Scope must ensure that the resilient equilibrium of Sky Governance remains protected against all potential direct and indirect threats.',
        },
        type: 'text',
        plain_text:
          'The Governance Scope regulates the governance processes and balance of power of the Sky Ecosystem. The Governance Scope must ensure that the resilient equilibrium of Sky Governance remains protected against all potential direct and indirect threats.',
        annotations: {
          bold: false,
          code: false,
          color: 'default',
          italic: false,
          underline: false,
          strikethrough: false,
        },
      },
    ],
  },
  {
    atlas_document_uuid: '1ce14bd8-c7b3-4f74-a152-292a8d8ebed0',
    atlas_document_number: 'A.2',
    plain_text_name: 'The Support Scope',
    plain_text_content:
      'The Support Scope governs all routine aspects of ecosystem support, including governance process infrastructure and management, Agent support and Ecosystem Actor support.',
    json_name: [
      {
        href: null,
        text: { link: null, content: 'The Support Scope' },
        type: 'text',
        plain_text: 'The Support Scope',
        annotations: {
          bold: false,
          code: false,
          color: 'default',
          italic: false,
          underline: false,
          strikethrough: false,
        },
      },
    ],
    json_content: [
      {
        href: null,
        text: {
          link: null,
          content:
            'The Support Scope governs all routine aspects of ecosystem support, including governance process infrastructure and management, Agent support and Ecosystem Actor support.',
        },
        type: 'text',
        plain_text:
          'The Support Scope governs all routine aspects of ecosystem support, including governance process infrastructure and management, Agent support and Ecosystem Actor support.',
        annotations: {
          bold: false,
          code: false,
          color: 'default',
          italic: false,
          underline: false,
          strikethrough: false,
        },
      },
    ],
  },
  {
    atlas_document_uuid: 'd56538fc-2220-491a-a4d2-7ad6e461d707',
    atlas_document_number: 'A.3',
    plain_text_name: 'The Stability Scope',
    plain_text_content:
      'The Stability Scope governs the management of the USDS Stablecoin. The USDS Stablecoin must be a permissionless and useful currency available to anyone. Its stability and risk must be managed to generate as much value for Sky and public good as possible.',
    json_name: [
      {
        href: null,
        text: { link: null, content: 'The Stability Scope' },
        type: 'text',
        plain_text: 'The Stability Scope',
        annotations: {
          bold: false,
          code: false,
          color: 'default',
          italic: false,
          underline: false,
          strikethrough: false,
        },
      },
    ],
    json_content: [
      {
        href: null,
        text: {
          link: null,
          content:
            'The Stability Scope governs the management of the USDS Stablecoin. The USDS Stablecoin must be a permissionless and useful currency available to anyone. Its stability and risk must be managed to generate as much value for Sky and public good as possible.',
        },
        type: 'text',
        plain_text:
          'The Stability Scope governs the management of the USDS Stablecoin. The USDS Stablecoin must be a permissionless and useful currency available to anyone. Its stability and risk must be managed to generate as much value for Sky and public good as possible.',
        annotations: {
          bold: false,
          code: false,
          color: 'default',
          italic: false,
          underline: false,
          strikethrough: false,
        },
      },
    ],
  },
  {
    atlas_document_uuid: '5c20d9af-0bb9-4ca1-a944-1e2cb6f8bb6b',
    atlas_document_number: 'A.4',
    plain_text_name: 'The Protocol Scope',
    plain_text_content:
      'The Protocol Scope regulates the maintenance and development of the core Sky Protocol and its critical, non-collateral components. The Protocol Scope defines all rules for protocol engineering.',
    json_name: [
      {
        href: null,
        text: { link: null, content: 'The Protocol Scope' },
        type: 'text',
        plain_text: 'The Protocol Scope',
        annotations: {
          bold: false,
          code: false,
          color: 'default',
          italic: false,
          underline: false,
          strikethrough: false,
        },
      },
    ],
    json_content: [
      {
        href: null,
        text: {
          link: null,
          content:
            'The Protocol Scope regulates the maintenance and development of the core Sky Protocol and its critical, non-collateral components. The Protocol Scope defines all rules for protocol engineering.',
        },
        type: 'text',
        plain_text:
          'The Protocol Scope regulates the maintenance and development of the core Sky Protocol and its critical, non-collateral components. The Protocol Scope defines all rules for protocol engineering.',
        annotations: {
          bold: false,
          code: false,
          color: 'default',
          italic: false,
          underline: false,
          strikethrough: false,
        },
      },
    ],
  },
  {
    atlas_document_uuid: '99b1b47d-3c7a-4859-ac00-8c0849f9070e',
    atlas_document_number: 'A.5',
    plain_text_name: 'The Accessibility Scope',
    plain_text_content:
      'The Accessibility Scope governs accessibility and distribution efforts, and regulates user-facing frontends.',
    json_name: [
      {
        href: null,
        text: { link: null, content: 'The Accessibility Scope' },
        type: 'text',
        plain_text: 'The Accessibility Scope',
        annotations: {
          bold: false,
          code: false,
          color: 'default',
          italic: false,
          underline: false,
          strikethrough: false,
        },
      },
    ],
    json_content: [
      {
        href: null,
        text: {
          link: null,
          content:
            'The Accessibility Scope governs accessibility and distribution efforts, and regulates user-facing frontends.',
        },
        type: 'text',
        plain_text:
          'The Accessibility Scope governs accessibility and distribution efforts, and regulates user-facing frontends.',
        annotations: {
          bold: false,
          code: false,
          color: 'default',
          italic: false,
          underline: false,
          strikethrough: false,
        },
      },
    ],
  },
  {
    atlas_document_uuid: '4a08ca6c-e652-49e4-9b79-4831b20e600a',
    atlas_document_number: 'A.6',
    plain_text_name: 'The Agent Scope',
    plain_text_content:
      'The Agent Scope regulates all Agents within the Sky Ecosystem and comprises all Agent Artifacts. Each Agent Artifact governs the operations of a particular Agent.',
    json_name: [
      {
        href: null,
        text: { link: null, content: 'The Agent Scope' },
        type: 'text',
        plain_text: 'The Agent Scope',
        annotations: {
          bold: false,
          code: false,
          color: 'default',
          italic: false,
          underline: false,
          strikethrough: false,
        },
      },
    ],
    json_content: [
      {
        href: null,
        text: {
          link: null,
          content:
            'The Agent Scope regulates all Agents within the Sky Ecosystem and comprises all Agent Artifacts. Each Agent Artifact governs the operations of a particular Agent.',
        },
        type: 'text',
        plain_text:
          'The Agent Scope regulates all Agents within the Sky Ecosystem and comprises all Agent Artifacts. Each Agent Artifact governs the operations of a particular Agent.',
        annotations: {
          bold: false,
          code: false,
          color: 'default',
          italic: false,
          underline: false,
          strikethrough: false,
        },
      },
    ],
  },
];

/**
 * Article document data for creating Article documents.
 * These documents are required for the Atlas tree builder logic to function.
 */
interface ArticleDocumentData {
  atlas_document_uuid: string;
  atlas_document_number: string;
  plain_text_name: string;
  plain_text_content: string;
  json_name: Json;
  json_content: Json;
  parent_scope_doc_no: string; // Document number of the parent Scope (e.g., "A.6")
}

const ARTICLE_DOCUMENTS_DATA: ArticleDocumentData[] = [
  {
    atlas_document_uuid: '6889e3e5-1e95-425c-843b-6924b0f164ae',
    atlas_document_number: 'A.6.1',
    plain_text_name: 'Agent Artifacts',
    plain_text_content: 'This Article includes the Artifacts of each Agent.',
    parent_scope_doc_no: 'A.6',
    json_name: [
      {
        href: null,
        text: { link: null, content: 'Agent Artifacts' },
        type: 'text',
        plain_text: 'Agent Artifacts',
        annotations: {
          bold: false,
          code: false,
          color: 'default',
          italic: false,
          underline: false,
          strikethrough: false,
        },
      },
    ],
    json_content: [
      {
        href: null,
        text: { link: null, content: 'This Article includes the Artifacts of each Agent.' },
        type: 'text',
        plain_text: 'This Article includes the Artifacts of each Agent.',
        annotations: {
          bold: false,
          code: false,
          color: 'default',
          italic: false,
          underline: false,
          strikethrough: false,
        },
      },
    ],
  },
];

/**
 * Section document data for creating Section documents.
 * These documents are required for the Atlas tree builder logic to function.
 */
interface SectionDocumentData {
  atlas_document_uuid: string;
  atlas_document_number: string;
  plain_text_name: string;
  plain_text_content: string;
  json_name: Json;
  json_content: Json;
  parent_article_doc_no: string; // Document number of the parent Article (e.g., "A.6.1")
  sort_order: number;
}

const SECTION_DOCUMENTS_DATA: SectionDocumentData[] = [
  {
    atlas_document_uuid: '9fb7f1cc-f60b-4195-892d-5e540f969973',
    atlas_document_number: 'A.6.1 - A1 - List Of Prime Agent Artifacts',
    plain_text_name: 'A.6.1 - A1 - List Of Prime Agent Artifacts',
    plain_text_content:
      "The documents herein each set out the unique Artifact for a particular Prime Agent. Prime Agent Artifacts contain all rules, processes, parameters, and information relevant to the Prime Agent. Prime Agent Artifacts are collections of documents that define each Agent's strategic vision and day-to-day operational logic.",
    parent_article_doc_no: 'A.6.1',
    sort_order: 0,
    json_name: [
      {
        href: null,
        text: { link: null, content: 'A.6.1 - A1 - List Of Prime Agent Artifacts' },
        type: 'text',
        plain_text: 'A.6.1 - A1 - List Of Prime Agent Artifacts',
        annotations: {
          bold: false,
          code: false,
          color: 'default',
          italic: false,
          underline: false,
          strikethrough: false,
        },
      },
    ],
    json_content: [
      {
        href: null,
        text: {
          link: null,
          content:
            "The documents herein each set out the unique Artifact for a particular Prime Agent. Prime Agent Artifacts contain all rules, processes, parameters, and information relevant to the Prime Agent. Prime Agent Artifacts are collections of documents that define each Agent's strategic vision and day-to-day operational logic.",
        },
        type: 'text',
        plain_text:
          "The documents herein each set out the unique Artifact for a particular Prime Agent. Prime Agent Artifacts contain all rules, processes, parameters, and information relevant to the Prime Agent. Prime Agent Artifacts are collections of documents that define each Agent's strategic vision and day-to-day operational logic.",
        annotations: {
          bold: false,
          code: false,
          color: 'default',
          italic: false,
          underline: false,
          strikethrough: false,
        },
      },
    ],
  },
  {
    atlas_document_uuid: 'df62511d-afe5-42db-8bd4-6452c5a0f464',
    atlas_document_number: 'A.6.1 - A2 - List Of Executor Agent Artifacts',
    plain_text_name: 'A.6.1 - A2 - List Of Executor Agent Artifacts',
    plain_text_content:
      'The documents herein each set out the Artifacts for Executor Agents. Executor Agent Artifacts contain all rules, processes, parameters, and information relevant to the Agent.',
    parent_article_doc_no: 'A.6.1',
    sort_order: 1,
    json_name: [
      {
        href: null,
        text: { link: null, content: 'A.6.1 - A2 - List Of Executor Agent Artifacts' },
        type: 'text',
        plain_text: 'A.6.1 - A2 - List Of Executor Agent Artifacts',
        annotations: {
          bold: false,
          code: false,
          color: 'default',
          italic: false,
          underline: false,
          strikethrough: false,
        },
      },
    ],
    json_content: [
      {
        href: null,
        text: {
          link: null,
          content:
            'The documents herein each set out the Artifacts for Executor Agents. Executor Agent Artifacts contain all rules, processes, parameters, and information relevant to the Agent.',
        },
        type: 'text',
        plain_text:
          'The documents herein each set out the Artifacts for Executor Agents. Executor Agent Artifacts contain all rules, processes, parameters, and information relevant to the Agent.',
        annotations: {
          bold: false,
          code: false,
          color: 'default',
          italic: false,
          underline: false,
          strikethrough: false,
        },
      },
    ],
  },
];

/**
 * Type for storing database ID mappings
 */
interface DatabaseMapping {
  name: AtlasDatabaseName;
  testName: string;
  databaseId: string;
}

/**
 * Type for storing created Scope page information
 */
interface CreatedScopePage {
  notionPageId: string;
  scopeData: ScopeDocumentData;
}

/**
 * Type for storing created Article page information
 */
interface CreatedArticlePage {
  notionPageId: string;
  articleData: ArticleDocumentData;
}

/**
 * Type for storing created Section page information
 */
interface CreatedSectionPage {
  notionPageId: string;
  sectionData: SectionDocumentData;
}

/**
 * Main execution function
 */
async function main() {
  // Load environment variables
  loadEnv();

  if (process.env.USE_DEV_NOTION_IDS !== 'true') {
    console.error('❌ USE_DEV_NOTION_IDS must be set to true');
    process.exit(1);
  }

  console.log('🚀 Starting Test Notion Databases Creation\n');
  console.log(`Parent Page ID: ${TEST_PARENT_PAGE_ID}`);
  console.log(`Delete Existing: ${DELETE_EXISTING ? 'YES' : 'NO'}\n`);

  try {
    // Step 1: Validate parent page exists
    await validateParentPage();

    // Step 2: Discover and optionally cleanup existing test databases
    const existingDatabases = await discoverTestDatabases();
    await handleExistingDatabases(existingDatabases);

    // Step 3: Create all databases (first pass - without relations)
    console.log('\n📦 Creating test databases (first pass - basic properties)...\n');
    const databaseMappings = await createAllDatabases();

    // Step 4: Add relationship properties (second pass)
    console.log('\n🔗 Adding relationship properties (second pass)...\n');
    await addRelationshipProperties(databaseMappings);

    // Step 5: Create root Scope documents in Notion
    const createdScopePages = await createScopeDocuments(databaseMappings);

    // Step 6: Upsert Scope documents to Supabase
    await upsertScopeDocumentsToSupabase(createdScopePages);

    // Step 7: Create UUID mappings for Scope documents
    await createUuidMappingsForScopeDocuments(createdScopePages);

    // Step 8: Create Article documents in Notion (children of Scopes)
    const createdArticlePages = await createArticleDocuments(databaseMappings, createdScopePages);

    // Step 9: Upsert Article documents to Supabase
    await upsertArticleDocumentsToSupabase(createdArticlePages);

    // Step 10: Create UUID mappings for Article documents
    await createUuidMappingsForArticleDocuments(createdArticlePages);

    // Step 11: Create Section documents in Notion (children of Articles)
    const createdSectionPages = await createSectionDocuments(databaseMappings, createdArticlePages);

    // Step 12: Upsert Section documents to Supabase
    await upsertSectionDocumentsToSupabase(createdSectionPages);

    // Step 13: Create UUID mappings for Section documents
    await createUuidMappingsForSectionDocuments(createdSectionPages);

    // Step 14: Update notion-ids-dev.ts with new database IDs
    console.log('\n📝 Updating notion-ids-dev.ts...\n');
    updateNotionIdsDevFile(databaseMappings);

    // Step 15: Validation and reporting
    console.log('\n✅ Validating created databases...\n');
    await validateAndReport(databaseMappings);

    // Step 16: Display manual step reminder for sub-item enablement
    displayManualStepReminder(databaseMappings);

    console.log('\n🎉 Test database creation completed successfully!\n');
  } catch (error) {
    console.error('\n❌ Error during test database creation:');
    console.error(error instanceof Error ? error.message : String(error));
    if (error instanceof Error && error.stack) {
      console.error(error.stack);
    }
    process.exit(1);
  }
}

/**
 * Validates that the parent page exists and is accessible
 */
async function validateParentPage() {
  console.log('🔍 Validating parent page...');
  try {
    const page = await notion().pages.retrieve({ page_id: TEST_PARENT_PAGE_ID });
    console.log(`✓ Parent page found: ${page.id}\n`);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    throw new Error(`Failed to access parent page ${TEST_PARENT_PAGE_ID}: ${errorMessage}`);
  }
}

/**
 * Discovers existing test databases under the parent page
 */
async function discoverTestDatabases(): Promise<Array<{ id: string; title: string }>> {
  console.log('🔍 Discovering existing test databases...');

  const testDatabases: Array<{ id: string; title: string }> = [];
  let hasMore = true;
  let startCursor: string | undefined = undefined;

  while (hasMore) {
    const response = await notion().blocks.children.list({
      block_id: TEST_PARENT_PAGE_ID,
      start_cursor: startCursor,
      page_size: 100,
    });

    for (const block of response.results) {
      // Check if block is a child database
      if ('type' in block && block.type === 'child_database' && 'child_database' in block) {
        const title = block.child_database.title;
        if (title.startsWith(TEST_PREFIX)) {
          testDatabases.push({
            id: block.id,
            title,
          });
        }
      }
    }

    hasMore = response.has_more;
    startCursor = response.next_cursor || undefined;
  }

  console.log(`Found ${testDatabases.length} existing test database(s)\n`);
  if (testDatabases.length > 0) {
    testDatabases.forEach((db) => console.log(`  - ${db.title} (${db.id})`));
    console.log();
  }

  return testDatabases;
}

/**
 * Handles existing test databases based on --delete-existing flag
 */
async function handleExistingDatabases(existingDatabases: Array<{ id: string; title: string }>) {
  if (existingDatabases.length === 0) {
    return;
  }

  if (!DELETE_EXISTING) {
    console.error('❌ Test databases already exist!');
    console.error('   Use --delete-existing flag to archive them first.\n');
    process.exit(1);
  }

  console.log('🗑️  Archiving existing test databases...\n');

  for (const db of existingDatabases) {
    try {
      await notion().databases.update({
        database_id: db.id,
        archived: true,
      });
      console.log(`  ✓ Archived: ${db.title}`);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error(`  ✗ Failed to archive ${db.title}: ${errorMessage}`);
    }
  }

  console.log();
}

/**
 * Creates all test databases with basic properties (non-relation)
 */
async function createAllDatabases(): Promise<DatabaseMapping[]> {
  const mappings: DatabaseMapping[] = [];

  for (const [_, databaseName] of Object.entries(ATLAS_DATABASES)) {
    try {
      const testName = `${TEST_PREFIX} ${databaseName}`;
      console.log(`Creating: ${testName}...`);

      const properties = buildDatabaseProperties(databaseName);
      const database = await notion().databases.create({
        parent: { type: 'page_id', page_id: TEST_PARENT_PAGE_ID },
        title: [
          {
            type: 'text',
            text: { content: testName },
          },
        ],
        properties,
      });

      mappings.push({
        name: databaseName,
        testName,
        databaseId: database.id,
      });

      console.log(`  ✓ Created with ID: ${database.id}`);
      console.log(`  ✓ Properties: ${Object.keys(properties).length}`);
      console.log();
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error(`  ✗ Failed to create ${databaseName}:`);
      console.error(`    ${errorMessage}`);
      console.log();
      throw error;
    }
  }

  return mappings;
}

/**
 * Builds the property schema for a database based on configuration
 */
function buildDatabaseProperties(databaseName: AtlasDatabaseName): NotionDatabaseProperties {
  const config = NOTION_DATABASE_PROPERTIES_AND_RELATIONSHIPS[databaseName];
  const propertyOverrides = NOTION_PROPERTY_TYPE_OVERRIDES[databaseName] || {};
  const properties: NotionDatabaseProperties = {};

  // Build properties from the property mapping
  for (const [_key, notionPropertyName] of Object.entries(config.properties)) {
    if (notionPropertyName === null) {
      continue;
    }

    // Determine property type from overrides, but always treat atlasDocumentType as 'select'
    // (The Type field is always a select field in Notion, is not in the overrides because it is handled globally for all Notion databases)
    let propertyType = propertyOverrides[notionPropertyName] || 'rich_text';
    if (notionPropertyName === config.properties.atlasDocumentType) {
      propertyType = 'select';
    }

    // Build property definition based on type
    switch (propertyType) {
      case 'title':
        properties[notionPropertyName] = { title: {} };
        break;

      case 'rich_text':
        properties[notionPropertyName] = { rich_text: {} };
        break;

      case 'number':
        properties[notionPropertyName] = { number: { format: 'number' } };
        break;

      case 'select':
        // Handle select fields with their specific options
        let options: string[] = [];

        if (notionPropertyName === config.properties.atlasDocumentType) {
          // Type field - use database-specific document types
          options = DATABASE_DOCUMENT_TYPES[databaseName] || [];
        } else if (SELECT_FIELD_OPTIONS[notionPropertyName]) {
          // Other select fields
          options = SELECT_FIELD_OPTIONS[notionPropertyName];
        }

        properties[notionPropertyName] = {
          select: {
            options: options.map((name) => ({ name })),
          },
        };
        break;

      default:
        // Default to rich_text for unknown types
        properties[notionPropertyName] = { rich_text: {} };
    }
  }

  // Add extra fields based on document types in this database
  addExtraFieldProperties(properties, databaseName, propertyOverrides);

  return properties;
}

/**
 * Adds extra field properties for specific document types.
 *
 * This function is data-driven and uses the DOCUMENT_TYPE_EXTRA_FIELDS mapping
 * (imported from notion-database-properties-and-relationships.ts) to automatically
 * add extra fields for any document type that has them defined.
 *
 * To add support for a new document type with extra fields:
 * 1. Add the property mapping constant in notion-database-properties-and-relationships.ts
 * 2. Add an entry to DOCUMENT_TYPE_EXTRA_FIELDS in the same file
 * 3. No changes needed to this function - it will automatically pick up the new fields!
 */
function addExtraFieldProperties(
  properties: NotionDatabaseProperties,
  databaseName: AtlasDatabaseName,
  propertyOverrides: Record<string, string>,
): void {
  const documentTypes = DATABASE_DOCUMENT_TYPES[databaseName];

  // Iterate through all document types in this database
  for (const documentType of documentTypes) {
    const extraFieldMapping = DOCUMENT_TYPE_EXTRA_FIELDS[documentType];

    // Skip if this document type doesn't have extra fields
    if (!extraFieldMapping) {
      continue;
    }

    // Add each extra field property
    for (const [_key, notionPropertyName] of Object.entries(extraFieldMapping)) {
      // Skip if property already exists (from main property mapping)
      if (properties[notionPropertyName]) {
        continue;
      }

      // Determine the property type (default to rich_text)
      const propertyType = propertyOverrides[notionPropertyName] || 'rich_text';

      // Build the property definition based on type
      if (propertyType === 'select') {
        properties[notionPropertyName] = {
          select: {
            options: SELECT_FIELD_OPTIONS[notionPropertyName]?.map((name) => ({ name })) || [],
          },
        };
      } else if (propertyType === 'number') {
        properties[notionPropertyName] = { number: { format: 'number' } };
      } else {
        // Default to rich_text for all other types
        properties[notionPropertyName] = { rich_text: {} };
      }
    }
  }
}

/**
 * Adds relationship properties to all databases (second pass)
 */
async function addRelationshipProperties(databaseMappings: DatabaseMapping[]) {
  // Create lookup map for database names to their database IDs
  const databaseNameToIDMap = new Map<AtlasDatabaseName, string>();
  databaseMappings.forEach((mapping) => {
    databaseNameToIDMap.set(mapping.name as AtlasDatabaseName, mapping.databaseId);
  });

  for (const mapping of databaseMappings) {
    const config = NOTION_DATABASE_PROPERTIES_AND_RELATIONSHIPS[mapping.name];
    const relationshipsToAdd: Array<{
      propertyName: string;
      targetDbId: string;
      targetDbName: AtlasDatabaseName;
      isTwoWay: boolean;
      inverseName?: string;
    }> = [];

    // Process child relationships
    for (const [targetDbName, propertyName] of Object.entries(config.childRelationships)) {
      const targetDbId = databaseNameToIDMap.get(targetDbName as AtlasDatabaseName);
      if (!targetDbId) {
        console.warn(`  ⚠️  Skipping relationship to ${targetDbName} (database not found)`);
        continue;
      }

      // Determine the inverse relationship name
      let inverseName: string | undefined;

      if (targetDbName === mapping.name) {
        // Same-database relationship: use parentPropertyName as the inverse
        inverseName = config.parentPropertyName;
      } else {
        // Inter-database relationship: look up the inverse in target's parentRelationships
        const targetConfig = NOTION_DATABASE_PROPERTIES_AND_RELATIONSHIPS[targetDbName as AtlasDatabaseName];
        inverseName = targetConfig?.parentRelationships?.[mapping.name];
      }

      relationshipsToAdd.push({
        propertyName,
        targetDbId,
        targetDbName: targetDbName as AtlasDatabaseName,
        isTwoWay: !!inverseName,
        inverseName: inverseName ?? undefined,
      });
    }

    // Add relationships to database
    if (relationshipsToAdd.length > 0) {
      console.log(`Adding relationships to: ${mapping.testName}`);

      for (const rel of relationshipsToAdd) {
        try {
          // Build relation configuration based on whether it's one-way or two-way
          let relationConfig: Record<string, unknown>;

          if (rel.isTwoWay && rel.inverseName) {
            // Two-way relation: uses dual_property with synced_property_name
            relationConfig = {
              database_id: rel.targetDbId,
              type: 'dual_property',
              dual_property: {
                synced_property_name: rel.inverseName,
              },
            };
          } else {
            // One-way relation: uses single_property
            relationConfig = {
              database_id: rel.targetDbId,
              type: 'single_property',
              single_property: {},
            };
          }

          // Notion API requires complex types for relation properties that we bypass with Record<string, unknown>
          const updateProperties: Record<string, unknown> = {
            [rel.propertyName]: {
              relation: relationConfig,
            },
          };

          await notion().databases.update({
            database_id: mapping.databaseId,
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            properties: updateProperties as any,
          });

          const relType = rel.isTwoWay ? 'two-way' : 'one-way';
          console.log(
            `  ✓ Added ${relType} relation: ${rel.propertyName} → ${rel.targetDbName}${rel.inverseName ? ` (inverse: ${rel.inverseName})` : ''}`,
          );
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : String(error);
          console.error(`  ✗ Failed to add relation ${rel.propertyName}:`);
          console.error(`    ${errorMessage}`);
        }
      }

      console.log();
    }
  }
}

/**
 * Validates created databases and prints summary report
 */
async function validateAndReport(databaseMappings: DatabaseMapping[]) {
  let totalProperties = 0;
  let totalRelationships = 0;

  for (const mapping of databaseMappings) {
    try {
      const database = await notion().databases.retrieve({ database_id: mapping.databaseId });
      const properties = Object.keys(database.properties);
      const relationProperties = properties.filter((key) => database.properties[key].type === 'relation');

      totalProperties += properties.length;
      totalRelationships += relationProperties.length;

      console.log(`✓ ${mapping.testName}`);
      console.log(`  - Properties: ${properties.length}`);
      console.log(`  - Relations: ${relationProperties.length}`);
      console.log(`  - URL: https://notion.so/${mapping.databaseId.replace(/-/g, '')}`);
      console.log();
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error(`✗ Failed to validate ${mapping.testName}: ${errorMessage}`);
    }
  }

  console.log('📊 Summary:');
  console.log(`  - Databases created: ${databaseMappings.length}`);
  console.log(`  - Total properties: ${totalProperties}`);
  console.log(`  - Total relationships: ${totalRelationships}`);
}

/**
 * Displays prominent reminder about manual sub-item enablement
 */
function displayManualStepReminder(databaseMappings: DatabaseMapping[]) {
  const sectionsDb = databaseMappings.find((m) => m.name === ATLAS_DATABASES.SECTIONS_AND_PRIMARY_DOCS);
  const agentsDb = databaseMappings.find((m) => m.name === ATLAS_DATABASES.AGENTS);

  console.log('\n' + '='.repeat(80));
  console.log('⚠️  IMPORTANT: MANUAL STEP REQUIRED');
  console.log('='.repeat(80));
  console.log();
  console.log('You must manually enable the "Sub-item" feature in Notion for these databases:');
  console.log();

  console.log('Steps to enable Sub-item feature:');
  console.log('  1. Click the URL below to open the database in Notion');
  console.log('  2. Click on Settings above the property names to open the menu for the view options');
  console.log('  3. Look for "More Settings" and select "Sub-items" option and enable it');
  console.log('  4. Open the view settings again.');
  console.log(
    '     In the Sub-items settings, to to Advanced Settings, and set the "Property" value to the value shown below',
  );
  console.log('     (This links the Sub-item feature to the correct relationship property)');
  console.log('  5. Repeat for both databases');
  console.log();
  console.log('This manual step is required to activate in-database relationships (parent-child).');
  console.log('Without this, the "Subdocs"/"Sub-item" and "Parent Doc"/"Parent item" properties');
  console.log('will not work correctly.');
  console.log('='.repeat(80));
  console.log();

  if (sectionsDb) {
    const url = `https://notion.so/${sectionsDb.databaseId.replace(/-/g, '')}`;
    console.log(`1. ${sectionsDb.testName}`);
    console.log(`   ${url}`);
    console.log(`   → Set "Property" value to: "Subdocs"`);
    console.log();
  }

  if (agentsDb) {
    const url = `https://notion.so/${agentsDb.databaseId.replace(/-/g, '')}`;
    console.log(`2. ${agentsDb.testName}`);
    console.log(`   ${url}`);
    console.log(`   → Set "Property" value to: "Sub-item"`);
    console.log();
  }
}

/**
 * Path to the notion-ids-dev.ts file
 */
const NOTION_IDS_DEV_FILE_PATH = path.join(process.cwd(), 'app/server/atlas/notion-mapping/notion-ids-dev.ts');

/**
 * Updates the notion-ids-dev.ts file with the newly created database IDs.
 * This allows the dev environment to use the test databases.
 */
function updateNotionIdsDevFile(databaseMappings: DatabaseMapping[]): void {
  // Read the current file content
  const fileContent = fs.readFileSync(NOTION_IDS_DEV_FILE_PATH, 'utf-8');

  // Build the new ATLAS_DATABASE_ID_MAP content
  const mapEntries = databaseMappings.map((mapping) => `  '${mapping.name}': '${mapping.databaseId}',`).join('\n');

  const newMapContent = `export const ATLAS_DATABASE_ID_MAP: Record<AtlasDatabaseName, string> = {
${mapEntries}
} as const;`;

  // Replace the existing ATLAS_DATABASE_ID_MAP using regex
  const mapRegex = /export const ATLAS_DATABASE_ID_MAP: Record<AtlasDatabaseName, string> = \{[\s\S]*?\} as const;/;

  if (!mapRegex.test(fileContent)) {
    throw new Error('Could not find ATLAS_DATABASE_ID_MAP in notion-ids-dev.ts');
  }

  const updatedContent = fileContent.replace(mapRegex, newMapContent);

  // Write the updated content back to the file
  fs.writeFileSync(NOTION_IDS_DEV_FILE_PATH, updatedContent, 'utf-8');

  console.log('✓ Updated ATLAS_DATABASE_ID_MAP in notion-ids-dev.ts');
  console.log('  File: app/server/atlas/notion-mapping/notion-ids-dev.ts');
  console.log();
  console.log('  New database IDs:');
  for (const mapping of databaseMappings) {
    console.log(`    ${mapping.name}: ${mapping.databaseId}`);
  }
}

/**
 * Creates root Scope documents in the test Scopes database.
 * These documents are required for the Atlas tree builder logic.
 */
async function createScopeDocuments(databaseMappings: DatabaseMapping[]): Promise<CreatedScopePage[]> {
  console.log('\n📄 Creating root Scope documents...\n');

  // Find the Scopes database ID from mappings
  const scopesDbMapping = databaseMappings.find((m) => m.name === ATLAS_DATABASES.SCOPES);
  if (!scopesDbMapping) {
    throw new Error('Scopes database not found in mappings');
  }

  const scopesDatabaseId = scopesDbMapping.databaseId;
  const createdPages: CreatedScopePage[] = [];

  // Get property names from the Scopes config
  const scopesConfig = NOTION_DATABASE_PROPERTIES_AND_RELATIONSHIPS[ATLAS_DATABASES.SCOPES];
  const contentPropertyName = scopesConfig.properties.content;

  // Verify content property exists for Scopes database (defensive check)
  if (!contentPropertyName) {
    throw new Error('Content property not defined for Scopes database');
  }

  for (const scopeData of SCOPE_DOCUMENTS_DATA) {
    try {
      console.log(`  Creating: ${scopeData.atlas_document_number} - ${scopeData.plain_text_name}...`);

      // Build Notion page properties using the configured property names
      const docNoPropertyName = scopesConfig.properties.atlasDocumentNo;
      const namePropertyName = scopesConfig.properties.atlasDocumentName;
      const typePropertyName = scopesConfig.properties.atlasDocumentType;

      const properties: Record<string, unknown> = {
        // Doc No (title)
        [docNoPropertyName]: {
          title: [{ text: { content: scopeData.atlas_document_number } }],
        },
        // Name (rich_text)
        [namePropertyName]: {
          rich_text: [{ type: 'text', text: { content: scopeData.plain_text_name } }],
        },
        // Type (select)
        [typePropertyName]: {
          select: { name: 'Scope' },
        },
        // Content (rich_text)
        [contentPropertyName]: {
          rich_text: [{ type: 'text', text: { content: scopeData.plain_text_content } }],
        },
      };

      // Create the page in Notion
      // Note: Using type assertion due to Notion SDK's strict property typing
      // which doesn't easily support dynamic property construction
      const notionClient = notion();
      const createdPage = await notionClient.pages.create({
        parent: { type: 'database_id', database_id: scopesDatabaseId },
        properties: properties as Parameters<typeof notionClient.pages.create>[0]['properties'],
      });

      createdPages.push({
        notionPageId: createdPage.id,
        scopeData,
      });

      console.log(`    ✓ Created with ID: ${createdPage.id}`);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error(`    ✗ Failed to create ${scopeData.atlas_document_number}: ${errorMessage}`);
      throw error;
    }
  }

  console.log(`\n  ✓ Created ${createdPages.length} Scope documents`);
  return createdPages;
}

/**
 * Upserts created Scope documents to the notion_database_pages table in Supabase.
 */
async function upsertScopeDocumentsToSupabase(createdPages: CreatedScopePage[]): Promise<void> {
  console.log('\n💾 Upserting Scope documents to Supabase...\n');

  const now = new Date().toISOString();

  // Build payload for versioned upsert
  const payload = createdPages.map((page) => ({
    notion_page_id: page.notionPageId,
    atlas_document_type: 'Scope' as const,
    atlas_document_number: page.scopeData.atlas_document_number,
    atlas_database_name: ATLAS_DATABASES.SCOPES,
    has_children: false,
    archived: false,
    in_trash: false,
    plain_text_content: page.scopeData.plain_text_content,
    json_content: page.scopeData.json_content,
    plain_text_name: page.scopeData.plain_text_name,
    json_name: page.scopeData.json_name,
    parent_notion_page_id: null,
    // All child arrays are empty - children will be synced later
    child_scope_ids: [],
    child_article_ids: [],
    child_section_and_primary_doc_ids: [],
    child_annotation_ids: [],
    child_tenet_ids: [],
    child_scenario_ids: [],
    child_scenario_variation_ids: [],
    child_active_data_ids: [],
    child_agent_scope_ids: [],
    child_needed_research_ids: [],
    extra_fields: {},
    sort_order: null,
    updated_at: now,
    last_edited_by_user_id: null,
  }));

  await supabase()
    .rpc('versioned_upsert_notion_database_pages', {
      p_rows: payload as Database['public']['Functions']['versioned_upsert_notion_database_pages']['Args']['p_rows'],
    })
    .throwOnError();

  console.log(`  ✓ Upserted ${createdPages.length} Scope documents to Supabase`);

  // Log the upserted page IDs
  for (const page of createdPages) {
    console.log(`    ${page.scopeData.atlas_document_number}: ${page.notionPageId}`);
  }
}

/**
 * Creates UUID mappings for the created Scope documents.
 */
async function createUuidMappingsForScopeDocuments(createdPages: CreatedScopePage[]): Promise<void> {
  console.log('\n🔗 Creating UUID mappings for Scope documents...\n');

  // Use fixed UUID mappings from the Scope document data
  // These UUIDs must match the UUIDs in the Atlas markdown file (exported-atlas/atlas.md)
  const uuidMappings = createdPages.map((page) => ({
    atlas_document_uuid: page.scopeData.atlas_document_uuid,
    notion_page_id: page.notionPageId,
  }));

  // Insert the UUID mappings
  await supabase().from('uuid_mapping').insert(uuidMappings).throwOnError();

  console.log(`  ✓ Created ${uuidMappings.length} UUID mappings`);

  // Log the mappings
  for (let i = 0; i < createdPages.length; i++) {
    console.log(`    ${createdPages[i].scopeData.atlas_document_number}: ${uuidMappings[i].atlas_document_uuid}`);
  }
}

/**
 * Creates Article documents in the test Articles database.
 * These documents are required for the Atlas tree builder logic to function.
 */
async function createArticleDocuments(
  databaseMappings: DatabaseMapping[],
  createdScopePages: CreatedScopePage[],
): Promise<CreatedArticlePage[]> {
  console.log('\n📄 Creating Article documents...\n');

  // Find the Articles database ID from mappings
  const articlesDbMapping = databaseMappings.find((m) => m.name === ATLAS_DATABASES.ARTICLES);
  if (!articlesDbMapping) {
    throw new Error('Articles database not found in mappings');
  }

  // Find the Scopes database ID for relationships
  const scopesDbMapping = databaseMappings.find((m) => m.name === ATLAS_DATABASES.SCOPES);
  if (!scopesDbMapping) {
    throw new Error('Scopes database not found in mappings');
  }

  // Build a lookup map for Scope pages by document number
  const scopePagesByDocNo = new Map<string, CreatedScopePage>();
  for (const scopePage of createdScopePages) {
    scopePagesByDocNo.set(scopePage.scopeData.atlas_document_number, scopePage);
  }

  const articlesDatabaseId = articlesDbMapping.databaseId;
  const createdPages: CreatedArticlePage[] = [];

  // Get property names from the Articles config
  const articlesConfig = NOTION_DATABASE_PROPERTIES_AND_RELATIONSHIPS[ATLAS_DATABASES.ARTICLES];
  const contentPropertyName = articlesConfig.properties.content;

  if (!contentPropertyName) {
    throw new Error('Content property not defined for Articles database');
  }

  for (const articleData of ARTICLE_DOCUMENTS_DATA) {
    try {
      console.log(`  Creating: ${articleData.atlas_document_number} - ${articleData.plain_text_name}...`);

      // Find the parent Scope page
      const parentScopePage = scopePagesByDocNo.get(articleData.parent_scope_doc_no);
      if (!parentScopePage) {
        throw new Error(
          `Parent Scope ${articleData.parent_scope_doc_no} not found for Article ${articleData.atlas_document_number}`,
        );
      }

      // Build Notion page properties using the configured property names
      const docNoPropertyName = articlesConfig.properties.atlasDocumentNo;
      const namePropertyName = articlesConfig.properties.atlasDocumentName;
      const typePropertyName = articlesConfig.properties.atlasDocumentType;
      const parentScopePropertyName = articlesConfig.parentRelationships[ATLAS_DATABASES.SCOPES];

      const properties: Record<string, unknown> = {
        // Doc No (title)
        [docNoPropertyName]: {
          title: [{ text: { content: articleData.atlas_document_number } }],
        },
        // Name (rich_text)
        [namePropertyName]: {
          rich_text: [{ type: 'text', text: { content: articleData.plain_text_name } }],
        },
        // Type (select)
        [typePropertyName]: {
          select: { name: 'Article' },
        },
        // Content (rich_text)
        [contentPropertyName]: {
          rich_text: [{ type: 'text', text: { content: articleData.plain_text_content } }],
        },
      };

      // Add parent Scope relationship if the property exists
      if (parentScopePropertyName) {
        properties[parentScopePropertyName] = {
          relation: [{ id: parentScopePage.notionPageId }],
        };
      }

      // Create the page in Notion
      const notionClient = notion();
      const createdPage = await notionClient.pages.create({
        parent: { type: 'database_id', database_id: articlesDatabaseId },
        properties: properties as Parameters<typeof notionClient.pages.create>[0]['properties'],
      });

      createdPages.push({
        notionPageId: createdPage.id,
        articleData,
      });

      console.log(`    ✓ Created with ID: ${createdPage.id}`);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error(`    ✗ Failed to create ${articleData.atlas_document_number}: ${errorMessage}`);
      throw error;
    }
  }

  console.log(`\n  ✓ Created ${createdPages.length} Article documents`);
  return createdPages;
}

/**
 * Upserts created Article documents to the notion_database_pages table in Supabase.
 */
async function upsertArticleDocumentsToSupabase(createdPages: CreatedArticlePage[]): Promise<void> {
  console.log('\n💾 Upserting Article documents to Supabase...\n');

  const now = new Date().toISOString();

  const payload = createdPages.map((page) => ({
    notion_page_id: page.notionPageId,
    atlas_document_type: 'Article' as const,
    atlas_document_number: page.articleData.atlas_document_number,
    atlas_database_name: ATLAS_DATABASES.ARTICLES,
    has_children: false,
    archived: false,
    in_trash: false,
    plain_text_content: page.articleData.plain_text_content,
    json_content: page.articleData.json_content,
    plain_text_name: page.articleData.plain_text_name,
    json_name: page.articleData.json_name,
    parent_notion_page_id: null,
    child_scope_ids: [],
    child_article_ids: [],
    child_section_and_primary_doc_ids: [],
    child_annotation_ids: [],
    child_tenet_ids: [],
    child_scenario_ids: [],
    child_scenario_variation_ids: [],
    child_active_data_ids: [],
    child_agent_scope_ids: [],
    child_needed_research_ids: [],
    extra_fields: {},
    sort_order: null,
    updated_at: now,
    last_edited_by_user_id: null,
  }));

  await supabase()
    .rpc('versioned_upsert_notion_database_pages', {
      p_rows: payload as Database['public']['Functions']['versioned_upsert_notion_database_pages']['Args']['p_rows'],
    })
    .throwOnError();

  console.log(`  ✓ Upserted ${createdPages.length} Article documents to Supabase`);

  for (const page of createdPages) {
    console.log(`    ${page.articleData.atlas_document_number}: ${page.notionPageId}`);
  }
}

/**
 * Creates UUID mappings for the created Article documents.
 */
async function createUuidMappingsForArticleDocuments(createdPages: CreatedArticlePage[]): Promise<void> {
  console.log('\n🔗 Creating UUID mappings for Article documents...\n');

  const uuidMappings = createdPages.map((page) => ({
    atlas_document_uuid: page.articleData.atlas_document_uuid,
    notion_page_id: page.notionPageId,
  }));

  await supabase().from('uuid_mapping').insert(uuidMappings).throwOnError();

  console.log(`  ✓ Created ${uuidMappings.length} UUID mappings`);

  for (let i = 0; i < createdPages.length; i++) {
    console.log(`    ${createdPages[i].articleData.atlas_document_number}: ${uuidMappings[i].atlas_document_uuid}`);
  }
}

/**
 * Creates Section documents in the test Sections & Primary Docs database.
 * These documents are required for the Atlas tree builder logic to function.
 */
async function createSectionDocuments(
  databaseMappings: DatabaseMapping[],
  createdArticlePages: CreatedArticlePage[],
): Promise<CreatedSectionPage[]> {
  console.log('\n📄 Creating Section documents...\n');

  // Find the Sections & Primary Docs database ID from mappings
  const sectionsDbMapping = databaseMappings.find((m) => m.name === ATLAS_DATABASES.SECTIONS_AND_PRIMARY_DOCS);
  if (!sectionsDbMapping) {
    throw new Error('Sections & Primary Docs database not found in mappings');
  }

  // Build a lookup map for Article pages by document number
  const articlePagesByDocNo = new Map<string, CreatedArticlePage>();
  for (const articlePage of createdArticlePages) {
    articlePagesByDocNo.set(articlePage.articleData.atlas_document_number, articlePage);
  }

  const sectionsDatabaseId = sectionsDbMapping.databaseId;
  const createdPages: CreatedSectionPage[] = [];

  // Get property names from the Sections config
  const sectionsConfig = NOTION_DATABASE_PROPERTIES_AND_RELATIONSHIPS[ATLAS_DATABASES.SECTIONS_AND_PRIMARY_DOCS];
  const contentPropertyName = sectionsConfig.properties.content;
  const sortOrderPropertyName = sectionsConfig.properties.sortOrder;

  if (!contentPropertyName) {
    throw new Error('Content property not defined for Sections & Primary Docs database');
  }

  for (const sectionData of SECTION_DOCUMENTS_DATA) {
    try {
      console.log(`  Creating: ${sectionData.atlas_document_number}...`);

      // Find the parent Article page
      const parentArticlePage = articlePagesByDocNo.get(sectionData.parent_article_doc_no);
      if (!parentArticlePage) {
        throw new Error(
          `Parent Article ${sectionData.parent_article_doc_no} not found for Section ${sectionData.atlas_document_number}`,
        );
      }

      // Build Notion page properties using the configured property names
      // Note: For Sections & Primary Docs, atlasDocumentNo and atlasDocumentName both map to 'Doc No (or Temp Name)'
      const docNoPropertyName = sectionsConfig.properties.atlasDocumentNo;
      const typePropertyName = sectionsConfig.properties.atlasDocumentType;
      const parentArticlePropertyName = sectionsConfig.parentRelationships[ATLAS_DATABASES.ARTICLES];

      const properties: Record<string, unknown> = {
        // Doc No (or Temp Name) - title
        [docNoPropertyName]: {
          title: [{ text: { content: sectionData.atlas_document_number } }],
        },
        // Type (select)
        [typePropertyName]: {
          select: { name: 'Section' },
        },
        // Content (rich_text)
        [contentPropertyName]: {
          rich_text: [{ type: 'text', text: { content: sectionData.plain_text_content } }],
        },
      };

      // Add sort order if the property exists
      if (sortOrderPropertyName) {
        properties[sortOrderPropertyName] = {
          number: sectionData.sort_order,
        };
      }

      // Add parent Article relationship if the property exists
      if (parentArticlePropertyName) {
        properties[parentArticlePropertyName] = {
          relation: [{ id: parentArticlePage.notionPageId }],
        };
      }

      // Create the page in Notion
      const notionClient = notion();
      const createdPage = await notionClient.pages.create({
        parent: { type: 'database_id', database_id: sectionsDatabaseId },
        properties: properties as Parameters<typeof notionClient.pages.create>[0]['properties'],
      });

      createdPages.push({
        notionPageId: createdPage.id,
        sectionData,
      });

      console.log(`    ✓ Created with ID: ${createdPage.id}`);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error(`    ✗ Failed to create ${sectionData.atlas_document_number}: ${errorMessage}`);
      throw error;
    }
  }

  console.log(`\n  ✓ Created ${createdPages.length} Section documents`);
  return createdPages;
}

/**
 * Upserts created Section documents to the notion_database_pages table in Supabase.
 */
async function upsertSectionDocumentsToSupabase(createdPages: CreatedSectionPage[]): Promise<void> {
  console.log('\n💾 Upserting Section documents to Supabase...\n');

  const now = new Date().toISOString();

  const payload = createdPages.map((page) => ({
    notion_page_id: page.notionPageId,
    atlas_document_type: 'Section' as const,
    atlas_document_number: page.sectionData.atlas_document_number,
    atlas_database_name: ATLAS_DATABASES.SECTIONS_AND_PRIMARY_DOCS,
    has_children: false,
    archived: false,
    in_trash: false,
    plain_text_content: page.sectionData.plain_text_content,
    json_content: page.sectionData.json_content,
    plain_text_name: page.sectionData.plain_text_name,
    json_name: page.sectionData.json_name,
    parent_notion_page_id: null,
    child_scope_ids: [],
    child_article_ids: [],
    child_section_and_primary_doc_ids: [],
    child_annotation_ids: [],
    child_tenet_ids: [],
    child_scenario_ids: [],
    child_scenario_variation_ids: [],
    child_active_data_ids: [],
    child_agent_scope_ids: [],
    child_needed_research_ids: [],
    extra_fields: {},
    sort_order: page.sectionData.sort_order.toString(),
    updated_at: now,
    last_edited_by_user_id: null,
  }));

  await supabase()
    .rpc('versioned_upsert_notion_database_pages', {
      p_rows: payload as Database['public']['Functions']['versioned_upsert_notion_database_pages']['Args']['p_rows'],
    })
    .throwOnError();

  console.log(`  ✓ Upserted ${createdPages.length} Section documents to Supabase`);

  for (const page of createdPages) {
    console.log(`    ${page.sectionData.atlas_document_number}: ${page.notionPageId}`);
  }
}

/**
 * Creates UUID mappings for the created Section documents.
 */
async function createUuidMappingsForSectionDocuments(createdPages: CreatedSectionPage[]): Promise<void> {
  console.log('\n🔗 Creating UUID mappings for Section documents...\n');

  const uuidMappings = createdPages.map((page) => ({
    atlas_document_uuid: page.sectionData.atlas_document_uuid,
    notion_page_id: page.notionPageId,
  }));

  await supabase().from('uuid_mapping').insert(uuidMappings).throwOnError();

  console.log(`  ✓ Created ${uuidMappings.length} UUID mappings`);

  for (let i = 0; i < createdPages.length; i++) {
    console.log(`    ${createdPages[i].sectionData.atlas_document_number}: ${uuidMappings[i].atlas_document_uuid}`);
  }
}

// Execute main function
main();
