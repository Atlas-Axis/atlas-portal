'use client';

import Link from 'next/link';
import { useState } from 'react';
import { Alert, Button } from '@heroui/react';
import { ExternalLink } from 'lucide-react';
import { uuidToNoHyphens } from '@/app/shared/utils/utils';
import type { CreateEditPageResult } from './_actions/create-edit-page-action';
import { createEditPageAction } from './_actions/create-edit-page-action';

export default function ActionButton({ notionPageId }: { notionPageId: string }) {
  const [loading, setLoading] = useState(false);
  const [isSuccessful, setIsSuccessful] = useState(false);
  const [message, setMessage] = useState('');
  const [result, setResult] = useState<CreateEditPageResult | null>(null);

  const handleButtonClick = async () => {
    setLoading(true);
    setMessage('');
    try {
      const result: CreateEditPageResult = await createEditPageAction(notionPageId);
      setIsSuccessful(result.success);
      setMessage(result.success ? 'Edit page created successfully!' : result.error || 'An error occurred');
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

      {isSuccessful && result?.data && (
        // Show a big Link button which navigates to the new page
        <Button
          as={Link}
          color="success"
          size="lg"
          href={`https://www.notion.so/${uuidToNoHyphens(result.data.newNotionPageId)}`}
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
