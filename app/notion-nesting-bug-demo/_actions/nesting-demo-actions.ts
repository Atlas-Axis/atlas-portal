'use server';

import { Client } from '@notionhq/client';
import type { CreatePageParameters } from '@notionhq/client';

const TEST_DATABASE_ID = '2944c4a7469b808b9ec6eeb59d239049';
const DEMO_NOTION_API_KEY = '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';

if (!DEMO_NOTION_API_KEY) {
  throw new Error('DEMO_NOTION_API_KEY is not set');
}

const notion = new Client({ auth: DEMO_NOTION_API_KEY });

interface CreateNestedPageResult {
  success: boolean;
  pageId: string;
  pageName: string;
  pageUrl: string;
  error?: string;
  parentItemSet: boolean;
  subItemSet: boolean;
}

interface DeleteAllPagesResult {
  success: boolean;
  deletedCount: number;
  error?: string;
}

interface NotionRelationProperty {
  relation: Array<{ id: string }>;
}

interface NotionTitleProperty {
  title: Array<{ plain_text: string }>;
}

interface NotionPage {
  id: string;
  properties: {
    Name?: NotionTitleProperty;
    'Parent item'?: NotionRelationProperty;
    'Sub-item'?: NotionRelationProperty;
  };
}

interface NotionDatabaseQueryResponse {
  results: unknown[];
  has_more: boolean;
  next_cursor: string | null;
}

/**
 * Creates a nested page in the test database and sets the Parent item relationship
 */
export async function createNestedPage(parentId: string | null, level: number): Promise<CreateNestedPageResult> {
  try {
    const pageName = `Level ${level} Page`;

    // Create the page with Parent item relationship
    const baseProperties: CreatePageParameters['properties'] = {
      Name: {
        title: [
          {
            type: 'text',
            text: {
              content: pageName,
            },
          },
        ],
      },
    };

    // Add Parent item relationship if parentId is provided
    const properties: CreatePageParameters['properties'] = parentId
      ? {
          ...baseProperties,
          'Parent item': {
            relation: [{ id: parentId }],
          },
        }
      : baseProperties;

    const createPayload: CreatePageParameters = {
      parent: {
        type: 'database_id',
        database_id: TEST_DATABASE_ID,
      },
      properties,
    };

    const newPage = await notion.pages.create(createPayload);

    // Wait 500ms to allow Notion to process the relationships
    await new Promise((resolve) => setTimeout(resolve, 500));

    // Fetch the newly created page to check if Parent item was set
    const createdPage = (await notion.pages.retrieve({
      page_id: newPage.id,
    })) as unknown as NotionPage;

    const parentItemSet = parentId !== null ? (createdPage.properties['Parent item']?.relation?.length ?? 0) > 0 : true;

    // Fetch the parent page to check if Sub-item was set
    let subItemSet = false;
    if (parentId) {
      const parentPage = (await notion.pages.retrieve({
        page_id: parentId,
      })) as unknown as NotionPage;

      const subItems = parentPage.properties['Sub-item']?.relation ?? [];
      subItemSet = subItems.some((item) => item.id === newPage.id);
    } else {
      // Root level has no parent, so Sub-item check doesn't apply
      subItemSet = true;
    }

    const pageUrl = `https://notion.so/${newPage.id.replace(/-/g, '')}`;

    return {
      success: true,
      pageId: newPage.id,
      pageName,
      pageUrl,
      parentItemSet,
      subItemSet,
    };
  } catch (error) {
    console.error('Error creating nested page:', error);

    return {
      success: false,
      pageId: '',
      pageName: '',
      pageUrl: '',
      error: error instanceof Error ? error.message : 'Unknown error',
      parentItemSet: false,
      subItemSet: false,
    };
  }
}

/**
 * Deletes all pages from the test database
 */
export async function deleteAllTestPages(): Promise<DeleteAllPagesResult> {
  try {
    const pages: NotionPage[] = [];
    let hasMore = true;
    let startCursor: string | undefined = undefined;

    // Fetch all pages from the database
    while (hasMore) {
      const response = (await notion.databases.query({
        database_id: TEST_DATABASE_ID,
        start_cursor: startCursor,
      })) as NotionDatabaseQueryResponse;

      pages.push(...(response.results as NotionPage[]));
      hasMore = response.has_more;
      startCursor = response.next_cursor ?? undefined;
    }

    // Archive all pages
    for (const page of pages) {
      await notion.pages.update({
        page_id: page.id,
        archived: true,
      });
    }

    return {
      success: true,
      deletedCount: pages.length,
    };
  } catch (error) {
    console.error('Error deleting test pages:', error);

    return {
      success: false,
      deletedCount: 0,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}
