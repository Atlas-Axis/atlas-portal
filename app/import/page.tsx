'use client';

import { useState } from 'react';
import { Button } from '@heroui/react';
import { importNotionPageAction } from './_actions/import-notion-page-action';

export default function Home() {
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState<string>('');

  const handleImport = async () => {
    setIsLoading(true);
    setMessage('');

    try {
      const result = await importNotionPageAction();

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

  return (
    <div>
      <h1 className="mb-3 text-2xl font-bold">Import Notion Page</h1>
      <Button variant="solid" color="primary" onPress={handleImport} isLoading={isLoading} disabled={isLoading}>
        {isLoading ? 'Importing...' : 'Import'}
      </Button>
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
