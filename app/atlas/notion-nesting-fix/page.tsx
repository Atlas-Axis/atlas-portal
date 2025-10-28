import type { Metadata } from 'next';
import { Content } from './content';

export const metadata: Metadata = {
  title: 'Notion Nesting Fix - Atlas',
  description: 'Fix Notion nesting issues in Atlas documents',
};

/**
 * This page provides a tool to fix parent relationship issues for deeply nested documents in Notion, caused by a Notion bug.
 * This page lets the user define ID mappings to overwrite the parent relationships for documents defined in the mapping.
 */
export default async function NotionNestingFixPage() {
  return (
    <div className="min-h-screen overflow-x-hidden bg-slate-100 p-6 pb-12">
      <Content />
    </div>
  );
}
