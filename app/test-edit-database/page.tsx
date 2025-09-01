import { Button } from '@heroui/button';
import { Card, CardBody, CardHeader } from '@heroui/card';
import { Divider } from '@heroui/divider';
import {
  NOTION_DATABASE_ID,
  NOTION_EDIT_PAGES_CONTAINING_PAGE_ID,
  NOTION_PAGE_ID,
} from '@/app/server/services/notion/_demo-data';
import { createNotionEditPagesAndDatabase } from '@/app/server/services/notion/create-edit-pages-and-edit-database';

async function testCreateEditDatabase() {
  'use server';

  try {
    console.log('Starting edit database creation test...');

    const result = await createNotionEditPagesAndDatabase({
      originalNotionDatabaseId: NOTION_DATABASE_ID,
      rootNotionPageId: NOTION_PAGE_ID, // Make sure this page exists in the database
      taskRunId: `test-${Date.now()}`,
      propertyWhitelist: ['Name', 'Content', 'Doc No (or Temp Name)', 'Sub-item'], // Include Sub-item for parent-child relationships // TODO: Make adjust if needed
      parent: {
        type: 'page_id',
        page_id: NOTION_EDIT_PAGES_CONTAINING_PAGE_ID,
      },
    });

    console.log('Edit database creation successful:', result);
  } catch (error) {
    console.error('Edit database creation failed:', error);
    throw error;
  }
}

export default function TestEditDatabasePage() {
  return (
    <div className="mx-auto max-w-4xl p-6">
      <Card className="p-6">
        <CardHeader>
          <h1 className="text-2xl font-bold">Create &quot;Edit Database&quot; and &quot;Edit Pages&quot; in Notion</h1>
        </CardHeader>
        <Divider />
        <CardBody className="space-y-4">
          <div>
            <h2 className="mb-2 text-lg font-semibold">Test Configuration</h2>
            <div className="space-y-2 text-sm">
              <p>
                <strong>Original Database ID:</strong> {NOTION_DATABASE_ID}
              </p>
              <p>
                <strong>Root Page ID:</strong> {NOTION_PAGE_ID}
              </p>
            </div>
          </div>

          <Divider />

          <div>
            <h2 className="mb-2 text-lg font-semibold">Instructions</h2>
            <ol className="list-inside list-decimal space-y-1 text-sm">
              <li>Ensure the Notion database and page IDs above exist and are accessible</li>
              <li>Make sure NOTION_SECRET_WRITE environment variable is set</li>
              <li>If the original database is in workspace, set NOTION_PARENT_PAGE_ID</li>
              <li>Click the test button below to run the edit database creation</li>
            </ol>
          </div>

          <Divider />

          <form action={testCreateEditDatabase}>
            <Button type="submit" color="primary" size="lg" className="w-full">
              Create Edit Database and Pages
            </Button>
          </form>

          <div className="text-xs text-gray-500">
            <p>Check the server console for detailed logs and results.</p>
            <p>
              The function will create a new Notion database and import it back to Supabase with edit page flags set.
            </p>
          </div>
        </CardBody>
      </Card>
    </div>
  );
}
