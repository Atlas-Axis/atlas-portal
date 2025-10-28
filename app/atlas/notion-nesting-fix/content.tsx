'use client';

import { Card, CardBody, CardHeader } from '@heroui/react';

/**
 * Notion Nesting Fix Content - Client Component
 *
 * Provides UI for fixing Notion nesting issues in Atlas documents by creating a mapping of document IDs and their parent IDs.
 * This mapping is stored in Supabase
 */
export function Content() {
  return (
    <Card className="mx-auto max-w-7xl p-6">
      <CardHeader className="flex-col items-start gap-2 border-b border-slate-200 pb-4">
        <h1 className="text-2xl font-bold text-slate-900">Notion Nesting Fix</h1>
        <p className="text-sm text-slate-600">Fix nesting issues in Notion Atlas documents</p>
      </CardHeader>
      <CardBody className="gap-6 p-6">
        <p className="text-slate-600">This feature is coming soon...</p>
      </CardBody>
    </Card>
  );
}
