'use client';

import { use } from 'react';

export default function Home({ params }: { params: Promise<{ 'notion-page-id': string }> }) {
  const { 'notion-page-id': notionPageId } = use(params);

  return (
    <div>
      <h1 className="mb-3 text-2xl font-bold">Edit Page Diff</h1>
      <h2>{notionPageId}</h2>
    </div>
  );
}
