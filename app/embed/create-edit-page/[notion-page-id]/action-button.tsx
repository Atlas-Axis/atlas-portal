'use client';

import Link from 'next/link';
import { useState } from 'react';
import { Alert, Button } from '@heroui/react';
import { ExternalLink } from 'lucide-react';
import { uuidToNoHyphens } from '@/app/shared/utils/utils';
import type { CreateEditPagesAndDatabaseActionResult } from './_actions/create-edit-pages-and-database-action';
import { createEditPagesAndDatabaseAction } from './_actions/create-edit-pages-and-database-action';

export default function ActionButton({ notionPageId }: { notionPageId: string }) {
  const [loading, setLoading] = useState(false);
  const [isSuccessful, setIsSuccessful] = useState(false);
  const [message, setMessage] = useState('');
  const [result, setResult] = useState<CreateEditPagesAndDatabaseActionResult | null>(null);

  const handleButtonClick = async () => {
    setLoading(true);
    setMessage('');
    try {
      const result: CreateEditPagesAndDatabaseActionResult = await createEditPagesAndDatabaseAction(notionPageId);
      setIsSuccessful(result.success);
      setMessage(result.message);
      setResult(result);
    } catch (error) {
      setIsSuccessful(false);
      setMessage(error instanceof Error ? error.message : 'An unknown error occurred');
      setResult(null);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex w-full flex-col items-center">
      {!isSuccessful && (
        <Button variant="solid" color="primary" size="lg" onPress={handleButtonClick} isLoading={loading}>
          {loading ? 'Creating Editable Page...' : 'Create Editable Page'}
        </Button>
      )}

      {isSuccessful && result?.result && (
        // Show a big Link button which navigates to the new database
        <Button
          as={Link}
          color="success"
          size="lg"
          href={`https://www.notion.so/${uuidToNoHyphens(result.result.newDatabaseId)}`}
          startContent={<ExternalLink />}
          className="text-white"
        >
          Open Editable Page
        </Button>
      )}

      {message && (
        <Alert
          title={isSuccessful ? '' : 'Error'}
          description={message}
          color={isSuccessful ? 'success' : 'danger'}
          className="my-4"
          isClosable={false}
        />
      )}
    </div>
  );
}
