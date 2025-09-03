'use client';

import { useState } from 'react';
import { Alert, Button, Card, CardBody, CardHeader, Divider, Input } from '@heroui/react';
import { NOTION_DATABASE_ID, NOTION_PAGE_ID } from '@/app/server/services/notion/_demo-data';
import { isValidUUID, uuidToHyphens } from '@/app/shared/utils/utils';
import { testNotionApiAction } from './_actions/test-notion-api-action';

interface ApiTestResult {
  success: boolean;
  message: string;
  data?: Record<string, unknown> | null;
}

export default function NotionApiKeyTestingPage() {
  const [apiKey, setApiKey] = useState('');
  const [pageId, setPageId] = useState(NOTION_PAGE_ID);
  const [databaseId, setDatabaseId] = useState(NOTION_DATABASE_ID);
  const [loadingStates, setLoadingStates] = useState({
    getPage: false,
    getDatabase: false,
    createPage: false,
  });
  const [results, setResults] = useState<{
    getPage?: ApiTestResult;
    getDatabase?: ApiTestResult;
    createPage?: ApiTestResult;
  }>({});

  const setLoading = (operation: keyof typeof loadingStates, loading: boolean) => {
    setLoadingStates((prev) => ({ ...prev, [operation]: loading }));
  };

  const setResult = (operation: keyof typeof results, result: ApiTestResult) => {
    setResults((prev) => ({ ...prev, [operation]: result }));
  };

  const normalizeUuid = (uuid: string): string => {
    if (!uuid) return '';
    const cleanUuid = uuid.replace(/-/g, '');
    if (cleanUuid.length === 32) {
      return uuidToHyphens(cleanUuid);
    }
    return uuid;
  };

  const formatJsonData = (data: Record<string, unknown> | null | undefined): string => {
    if (!data) return '';
    return JSON.stringify(data, null, 2);
  };

  const handleGetPage = async () => {
    if (!apiKey || !pageId) return;

    setLoading('getPage', true);

    try {
      const normalizedPageId = normalizeUuid(pageId);
      const result = await testNotionApiAction({
        apiKey,
        operation: 'getPage',
        pageId: normalizedPageId,
      });
      setResult('getPage', result);
    } catch (error) {
      setResult('getPage', {
        success: false,
        message: error instanceof Error ? error.message : 'Unknown error occurred',
      });
    } finally {
      setLoading('getPage', false);
    }
  };

  const handleGetDatabase = async () => {
    if (!apiKey || !databaseId) return;

    setLoading('getDatabase', true);

    try {
      const normalizedDatabaseId = normalizeUuid(databaseId);
      const result = await testNotionApiAction({
        apiKey,
        operation: 'getDatabase',
        databaseId: normalizedDatabaseId,
      });
      setResult('getDatabase', result);
    } catch (error) {
      setResult('getDatabase', {
        success: false,
        message: error instanceof Error ? error.message : 'Unknown error occurred',
      });
    } finally {
      setLoading('getDatabase', false);
    }
  };

  const handleCreatePage = async () => {
    if (!apiKey || !pageId) return;

    setLoading('createPage', true);

    try {
      const normalizedPageId = normalizeUuid(pageId);
      const result = await testNotionApiAction({
        apiKey,
        operation: 'createPage',
        pageId: normalizedPageId,
      });
      setResult('createPage', result);
    } catch (error) {
      setResult('createPage', {
        success: false,
        message: error instanceof Error ? error.message : 'Unknown error occurred',
      });
    } finally {
      setLoading('createPage', false);
    }
  };

  const isValidPageInput = pageId && isValidUUID(normalizeUuid(pageId));
  const isValidDatabaseInput = databaseId && isValidUUID(normalizeUuid(databaseId));

  return (
    <div className="mx-auto max-w-4xl space-y-6 p-6">
      <Card className="p-6">
        <CardHeader>
          <h1 className="text-2xl font-bold">Notion API Key Testing</h1>
        </CardHeader>
        <CardBody className="space-y-6">
          <div className="space-y-4">
            <Alert
              color="primary"
              title="Demo Data Pre-loaded"
              description="The page and database ID fields are pre-populated with demo data. You can replace them with your own IDs if needed."
              className="mb-4"
            />

            <Input
              label="Notion API Key"
              placeholder="secret_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
              value={apiKey}
              onValueChange={setApiKey}
              type="password"
              description="Enter your Notion integration API key"
              className="w-full"
            />

            <Input
              label="Notion Page ID"
              placeholder="25ef7584-64c5-80f6-a11a-eab7080d03b1 or 25ef758464c580f6a11aeab7080d03b1"
              value={pageId}
              onValueChange={setPageId}
              description="Page ID with or without hyphens - will be normalized automatically"
              className="w-full"
              color={pageId && !isValidPageInput ? 'danger' : 'default'}
              errorMessage={pageId && !isValidPageInput ? 'Invalid UUID format' : ''}
            />

            <Input
              label="Notion Database ID"
              placeholder="25ef7584-64c5-8031-9597-e2a98756bbc8 or 25ef758464c580319597e2a98756bbc8"
              value={databaseId}
              onValueChange={setDatabaseId}
              description="Database ID with or without hyphens - will be normalized automatically"
              className="w-full"
              color={databaseId && !isValidDatabaseInput ? 'danger' : 'default'}
              errorMessage={databaseId && !isValidDatabaseInput ? 'Invalid UUID format' : ''}
            />
          </div>

          <Divider />

          <div className="space-y-4">
            <h2 className="text-lg font-semibold">API Tests</h2>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              <Button
                color="primary"
                onPress={handleGetPage}
                isLoading={loadingStates.getPage}
                isDisabled={!apiKey || !isValidPageInput}
                className="w-full"
              >
                {loadingStates.getPage ? 'Testing...' : 'Get Notion Page'}
              </Button>

              <Button
                color="primary"
                onPress={handleGetDatabase}
                isLoading={loadingStates.getDatabase}
                isDisabled={!apiKey || !isValidDatabaseInput}
                className="w-full"
              >
                {loadingStates.getDatabase ? 'Testing...' : 'Get Notion Database'}
              </Button>

              <Button
                color="primary"
                onPress={handleCreatePage}
                isLoading={loadingStates.createPage}
                isDisabled={!apiKey || !isValidPageInput}
                className="w-full"
              >
                {loadingStates.createPage ? 'Testing...' : 'Create Notion Page'}
              </Button>
            </div>
          </div>

          <Divider />

          <div className="space-y-4">
            <h2 className="text-lg font-semibold">Results</h2>

            {results.getPage && !loadingStates.getPage && (
              <div>
                <h3 className="mb-2 font-medium">Get Page Result:</h3>
                <Alert
                  color={results.getPage.success ? 'success' : 'danger'}
                  title={results.getPage.success ? 'Success' : 'Error'}
                  description={results.getPage.message}
                  className="mb-2"
                />
                {results.getPage.data && (
                  <pre className="max-h-64 overflow-auto rounded-lg bg-gray-100 p-4 text-xs">
                    {formatJsonData(results.getPage.data)}
                  </pre>
                )}
              </div>
            )}

            {results.getDatabase && !loadingStates.getDatabase && (
              <div>
                <h3 className="mb-2 font-medium">Get Database Result:</h3>
                <Alert
                  color={results.getDatabase.success ? 'success' : 'danger'}
                  title={results.getDatabase.success ? 'Success' : 'Error'}
                  description={results.getDatabase.message}
                  className="mb-2"
                />
                {results.getDatabase.data && (
                  <pre className="max-h-64 overflow-auto rounded-lg bg-gray-100 p-4 text-xs">
                    {formatJsonData(results.getDatabase.data)}
                  </pre>
                )}
              </div>
            )}

            {results.createPage && !loadingStates.createPage && (
              <div>
                <h3 className="mb-2 font-medium">Create Page Result:</h3>
                <Alert
                  color={results.createPage.success ? 'success' : 'danger'}
                  title={results.createPage.success ? 'Success' : 'Error'}
                  description={results.createPage.message}
                  className="mb-2"
                />
                {results.createPage.data && (
                  <pre className="max-h-64 overflow-auto rounded-lg bg-gray-100 p-4 text-xs">
                    {formatJsonData(results.createPage.data)}
                  </pre>
                )}
              </div>
            )}
          </div>
        </CardBody>
      </Card>
    </div>
  );
}
