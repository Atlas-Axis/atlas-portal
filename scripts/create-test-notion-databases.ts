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
 * Type for storing database ID mappings
 */
interface DatabaseMapping {
  name: AtlasDatabaseName;
  testName: string;
  databaseId: string;
}

/**
 * Main execution function
 */
async function main() {
  // Load environment variables
  loadEnv();

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

    // Step 5: Update notion-ids-dev.ts with new database IDs
    console.log('\n📝 Updating notion-ids-dev.ts...\n');
    updateNotionIdsDevFile(databaseMappings);

    // Step 6: Validation and reporting
    console.log('\n✅ Validating created databases...\n');
    await validateAndReport(databaseMappings);

    // Step 7: Display manual step reminder for sub-item enablement
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
    const page = await notion('write').pages.retrieve({ page_id: TEST_PARENT_PAGE_ID });
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
    const response = await notion('write').blocks.children.list({
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
      await notion('write').databases.update({
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
      const database = await notion('write').databases.create({
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

    const propertyType = propertyOverrides[notionPropertyName] || 'rich_text';

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

          await notion('write').databases.update({
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
      const database = await notion('write').databases.retrieve({ database_id: mapping.databaseId });
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

// Execute main function
main();
