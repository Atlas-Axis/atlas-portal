'use client';

import { useState } from 'react';
import { Button, Input } from '@heroui/react';
import { isValidUUID, uuidToHyphens } from '@/app/shared/utils/utils';
import { NOTION_ATLAS_SECTIONS_AND_PRIMARY_DOCS_DATABASE_ID } from '../server/services/notion/_demo-data';
import { importNotionDatabaseAction } from './_actions/import-notion-database-action';
import { importNotionPageAction } from './_actions/import-notion-page-action';

export default function Home() {
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState<string>('');
  const [notionPageId, setNotionPageId] = useState<string>('');
  const [notionDatabaseId, setNotionDatabaseId] = useState<string>(NOTION_ATLAS_SECTIONS_AND_PRIMARY_DOCS_DATABASE_ID);

  const normalizeUuid = (uuid: string): string => {
    if (!uuid) return '';
    const cleanUuid = uuid.replace(/-/g, '');
    if (cleanUuid.length === 32) {
      return uuidToHyphens(cleanUuid);
    }
    return uuid;
  };

  const handleImportPage = async () => {
    setIsLoading(true);
    setMessage('');

    try {
      const normalizedPageId = normalizeUuid(notionPageId);
      const result = await importNotionPageAction(normalizedPageId);

      if (result.success) {
        setMessage(result.message);
      } else {
        setMessage(`Error: ${result.message}`);
      }
    } catch (error) {
      setMessage('An unexpected error occurred');
      console.error('Import failed:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleImportDatabase = async () => {
    setIsLoading(true);
    setMessage('');

    try {
      const normalizedDatabaseId = normalizeUuid(notionDatabaseId);
      const result = await importNotionDatabaseAction(normalizedDatabaseId);

      if (result.success) {
        setMessage(result.message);
      } else {
        setMessage(`Error: ${result.message}`);
      }
    } catch (error) {
      setMessage('An unexpected error occurred');
      console.error('Import failed:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const isValidPageInput = Boolean(notionPageId) && isValidUUID(normalizeUuid(notionPageId));
  const isValidDatabaseInput = Boolean(notionDatabaseId) && isValidUUID(normalizeUuid(notionDatabaseId));

  return (
    <div className="p-6">
      <h1 className="mb-6 text-2xl font-bold">Import Notion Content</h1>

      <div className="mb-4 flex flex-col gap-4 sm:flex-row">
        <div className="border-default-400 rounded-lg border-2 p-4">
          <h2 className="mb-3 text-lg font-semibold">Import Notion Page</h2>
          <div className="mb-3">
            <Input
              label="Notion Page ID"
              placeholder="25ef7584-64c5-80f6-a11a-eab7080d03b1 or 25ef758464c580f6a11aeab7080d03b1"
              value={notionPageId}
              onValueChange={setNotionPageId}
              description="Page ID with or without hyphens - will be normalized automatically"
              className="w-full"
              color={notionPageId && !isValidPageInput ? 'danger' : 'default'}
              errorMessage={notionPageId && !isValidPageInput ? 'Invalid UUID format' : ''}
            />
          </div>
          <Button
            variant="solid"
            color="primary"
            onPress={handleImportPage}
            isLoading={isLoading}
            isDisabled={isLoading || !isValidPageInput}
          >
            {isLoading ? 'Importing...' : 'Import Page'}
          </Button>
        </div>

        <div className="border-default-400 rounded-lg border-2 p-4">
          <h2 className="mb-3 text-lg font-semibold">Import Notion Database (Sections & Primary Docs)</h2>
          <div className="mb-3">
            <Input
              label="Notion Database ID"
              placeholder="25ef7584-64c5-8031-9597-e2a98756bbc8 or 25ef758464c580319597e2a98756bbc8"
              value={notionDatabaseId}
              onValueChange={setNotionDatabaseId}
              description="Database ID with or without hyphens - will be normalized automatically"
              className="w-full"
              color={notionDatabaseId && !isValidDatabaseInput ? 'danger' : 'default'}
              errorMessage={notionDatabaseId && !isValidDatabaseInput ? 'Invalid UUID format' : ''}
            />
          </div>
          <Button
            variant="solid"
            color="primary"
            onPress={handleImportDatabase}
            isLoading={isLoading}
            isDisabled={isLoading || !isValidDatabaseInput}
          >
            {isLoading ? 'Importing...' : 'Import Database'}
          </Button>
        </div>
      </div>
      {message && (
        <div
          className={`mt-4 rounded p-3 ${message.startsWith('Error') ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}
        >
          {message}
        </div>
      )}
    </div>
  );
}
