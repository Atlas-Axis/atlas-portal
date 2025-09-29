#!/usr/bin/env node
import { notion } from '@/app/server/services/notion/notion-client';
import { loadEnv } from './scripts/utils/load-env';

async function checkPageMasterStatus() {
  loadEnv();

  const exampleId = '1b3f2ff0-8d73-8058-a715-efb37089f852';

  console.log(`🔍 Checking Master Status for page ${exampleId}...\n`);

  try {
    const page = await notion().pages.retrieve({ page_id: exampleId });
    console.log('✅ Page retrieved successfully from Notion API');

    if (page.object === 'page' && 'properties' in page) {
      const properties = page.properties;
      console.log('\n📋 Page properties:');
      console.log(`  - ID: ${page.id}`);
      console.log(`  - Archived: ${page.archived}`);
      console.log(`  - In trash: ${page.in_trash}`);
      console.log(`  - Created time: ${page.created_time}`);
      console.log(`  - Last edited time: ${page.last_edited_time}`);

      if (properties['Master Status'] && properties['Master Status'].type === 'relation') {
        const masterStatus = properties['Master Status'];
        console.log('\n🎯 Master Status property:');
        console.log(`  - Type: ${masterStatus.type}`);
        console.log(`  - Relations: ${JSON.stringify(masterStatus.relation, null, 2)}`);

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const relationIds = masterStatus.relation.map((rel: any) => rel.id);
        console.log(`  - Relation IDs: ${relationIds.join(', ')}`);

        // Check against known Master Status IDs
        const MASTER_STATUS_ID_MAP = {
          Archived: '3542b5e1-6848-4175-9400-db36a8c25b1b',
          Deferred: 'f38bf53d-96bd-4345-a403-c6629ed202a1',
          Approved: 'fe75a64f-585b-4d08-af00-ef8667d9c307',
          Provisional: '3dbb9d9c-fd63-462b-99f3-1ce879f16768',
          Placeholder: '3edf54e3-be0e-4bbb-b008-502cfc23394e',
        };

        console.log('\n🔍 Status analysis:');
        for (const [statusName, statusId] of Object.entries(MASTER_STATUS_ID_MAP)) {
          const hasStatus = relationIds.includes(statusId);
          console.log(`  - ${statusName}: ${hasStatus ? '✅ YES' : '❌ NO'}`);
        }

        const unknownIds = relationIds.filter((id) => !Object.values(MASTER_STATUS_ID_MAP).includes(id));
        if (unknownIds.length > 0) {
          console.log(`  - Unknown status IDs: ${unknownIds.join(', ')}`);
        }
      } else {
        console.log('\n❌ No Master Status property found or wrong type');
      }

      // Check Name property
      if (properties['Name'] && properties['Name'].type === 'title') {
        const nameProperty = properties['Name'];
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const plainText = nameProperty.title.map((t: any) => t.plain_text).join('');
        console.log(`\n📝 Page name: "${plainText}"`);
      }
    } else {
      console.log('❌ Retrieved object is not a page with properties');
    }
  } catch (error) {
    console.error('❌ Error retrieving page:', error);
  }
}

checkPageMasterStatus().catch(console.error);
