'use client';

import { useState } from 'react';
import { Button } from '@heroui/react';
import {
  NOTION_DATABASE_ID,
  NOTION_EDIT_PAGES_CONTAINING_DATABASE_ID,
  ROOT_NOTION_PAGE_ID_FOR_EDIT_PAGE_GENERATION,
} from '@/app/server/services/notion/_demo-data';
import { createEditPageAction } from './_actions/create-edit-page-action';

export default function TestTogglePage() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{
    newNotionPageId: string;
    blocksCreatedCount: number;
    duration?: number;
    details?: Record<string, unknown>;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleCreateTogglePage = async () => {
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const result = await createEditPageAction({
        originalNotionDatabaseId: NOTION_DATABASE_ID,
        rootNotionPageId: ROOT_NOTION_PAGE_ID_FOR_EDIT_PAGE_GENERATION,
        parent: {
          type: 'database_id',
          database_id: NOTION_EDIT_PAGES_CONTAINING_DATABASE_ID,
        },
      });

      if (!result.success) {
        throw new Error(result.error || 'Unknown error occurred');
      }

      setResult(result.data!);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error occurred');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container mx-auto p-8">
      <h1 className="mb-6 text-3xl font-bold">Test Edit Page Creation</h1>

      <div className="space-y-6">
        <div className="rounded-lg bg-gray-50 p-4">
          <h2 className="mb-2 text-lg font-semibold">Test Configuration</h2>
          <ul className="space-y-1 text-sm text-gray-600">
            <li>
              <strong>Original Database ID:</strong> {NOTION_DATABASE_ID}
            </li>
            <li>
              <strong>Root Page ID:</strong> {ROOT_NOTION_PAGE_ID_FOR_EDIT_PAGE_GENERATION}
            </li>
            <li>
              <strong>Parent Page ID:</strong> {NOTION_EDIT_PAGES_CONTAINING_DATABASE_ID}
            </li>
          </ul>
        </div>

        <Button color="primary" size="lg" onPress={handleCreateTogglePage} isLoading={loading} disabled={loading}>
          {loading ? 'Creating Edit Page...' : 'Create Edit Page'}
        </Button>

        {error && (
          <div className="rounded border border-red-200 bg-red-50 px-4 py-3 text-red-700">
            <strong>Error:</strong> {error}
          </div>
        )}

        {result && (
          <div className="rounded border border-green-200 bg-green-50 p-4">
            <h3 className="mb-2 text-lg font-semibold text-green-800">Success!</h3>
            <div className="space-y-1 text-sm text-green-700">
              <p>
                <strong>New Page ID:</strong> {result.newNotionPageId}
              </p>
              <p>
                <strong>Blocks Created:</strong> {result.blocksCreatedCount}
              </p>
              <p>
                <strong>Duration:</strong> {result.duration?.toFixed(2)}ms
              </p>
              {result.newNotionPageId && (
                <p>
                  <strong>View Page:</strong>{' '}
                  <a
                    href={`https://notion.so/${result.newNotionPageId.replace(/-/g, '')}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-600 underline hover:text-blue-800"
                  >
                    Open in Notion
                  </a>
                </p>
              )}
            </div>
          </div>
        )}

        {result?.details && (
          <div className="rounded border border-blue-200 bg-blue-50 p-4">
            <h3 className="mb-2 text-lg font-semibold text-blue-800">Details</h3>
            <pre className="overflow-auto rounded bg-blue-100 p-2 text-xs text-blue-700">
              {JSON.stringify(result.details, null, 2)}
            </pre>
          </div>
        )}
      </div>
    </div>
  );
}
