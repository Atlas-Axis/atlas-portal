'use server';

import { Client as NotionClient } from '@notionhq/client';
import { isValidUUID } from '@/app/shared/utils/utils';

interface TestNotionApiParams {
  apiKey: string;
  operation: 'getPage' | 'getDatabase' | 'createPage';
  pageId?: string;
  databaseId?: string;
}

interface TestNotionApiResult {
  success: boolean;
  message: string;
  data?: Record<string, unknown> | null;
}

export async function testNotionApiAction(params: TestNotionApiParams): Promise<TestNotionApiResult> {
  const { apiKey, operation, pageId, databaseId } = params;

  if (!apiKey) {
    return {
      success: false,
      message: 'API key is required',
    };
  }

  // Create a Notion client with the provided API key
  const notion = new NotionClient({ auth: apiKey });

  try {
    switch (operation) {
      case 'getPage': {
        if (!pageId) {
          return {
            success: false,
            message: 'Page ID is required for getPage operation',
          };
        }

        if (!isValidUUID(pageId)) {
          return {
            success: false,
            message: 'Invalid page ID format',
          };
        }

        const page = await notion.pages.retrieve({ page_id: pageId });

        return {
          success: true,
          message: `Successfully retrieved page: ${page.id}`,
          data: page,
        };
      }

      case 'getDatabase': {
        if (!databaseId) {
          return {
            success: false,
            message: 'Database ID is required for getDatabase operation',
          };
        }

        if (!isValidUUID(databaseId)) {
          return {
            success: false,
            message: 'Invalid database ID format',
          };
        }

        const database = await notion.databases.retrieve({ database_id: databaseId });

        return {
          success: true,
          message: `Successfully retrieved database: ${database.id}`,
          data: database,
        };
      }

      case 'createPage': {
        if (!pageId) {
          return {
            success: false,
            message: 'Parent page ID is required for createPage operation',
          };
        }

        if (!isValidUUID(pageId)) {
          return {
            success: false,
            message: 'Invalid parent page ID format',
          };
        }

        const newPage = await notion.pages.create({
          parent: {
            type: 'page_id',
            page_id: pageId,
          },
          properties: {
            title: {
              title: [
                {
                  text: {
                    content: `Test Page Created at ${new Date().toISOString()}`,
                  },
                },
              ],
            },
          },
          children: [
            {
              object: 'block',
              type: 'paragraph',
              paragraph: {
                rich_text: [
                  {
                    type: 'text',
                    text: {
                      content: 'This is a test page created by the Notion API key testing tool.',
                    },
                  },
                ],
              },
            },
          ],
        });

        return {
          success: true,
          message: `Successfully created page: ${newPage.id}`,
          data: newPage,
        };
      }

      default:
        return {
          success: false,
          message: `Unsupported operation: ${operation}`,
        };
    }
  } catch (error) {
    console.error(`Notion API ${operation} failed:`, error);

    // Handle specific Notion API errors
    if (error && typeof error === 'object' && 'code' in error) {
      const notionError = error as { code: string; message?: string };

      switch (notionError.code) {
        case 'unauthorized':
          return {
            success: false,
            message: 'API key is invalid or does not have permission to access this resource',
          };
        case 'object_not_found':
          return {
            success: false,
            message: 'The specified page or database was not found or is not accessible',
          };
        case 'validation_error':
          return {
            success: false,
            message: `Validation error: ${notionError.message || 'Invalid request parameters'}`,
          };
        case 'rate_limited':
          return {
            success: false,
            message: 'Rate limit exceeded. Please try again later.',
          };
        default:
          return {
            success: false,
            message: `Notion API error (${notionError.code}): ${notionError.message || 'Unknown error'}`,
          };
      }
    }

    return {
      success: false,
      message: error instanceof Error ? error.message : 'Unknown error occurred',
    };
  }
}
