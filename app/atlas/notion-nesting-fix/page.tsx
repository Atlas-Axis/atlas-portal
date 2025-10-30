/**
 * Notion Nesting Bug Fix - UI Page
 *
 * Server component that loads existing mappings and document names, then passes them to the client component.
 * Provides a UI for manually defining correct parent-child relationships to fix Notion nesting bugs.
 *
 * Protected by simple password authentication stored in a cookie.
 *
 * @see {@link file://../../docs/NOTION_NESTING_BUG_FIX.md} for complete documentation
 */
import type { Metadata } from 'next';
import { loadNotionNestingFixMappings } from '@/app/server/services/supabase/notion-nesting-bug-mappings';
import { supabase } from '@/app/server/services/supabase/supabase-client';
import { checkAuthentication } from './_actions/auth-actions';
import { Content } from './content';
import { PasswordInput } from './password-input';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Notion Nesting Fix - Atlas',
  description: 'Fix Notion nesting issues in Atlas documents',
};
export default async function NotionNestingFixPage() {
  // Check authentication
  const isAuthenticated = await checkAuthentication();

  // If not authenticated, show password input
  if (!isAuthenticated) {
    return <PasswordInput />;
  }

  // Load existing mappings
  const mappings = await loadNotionNestingFixMappings();

  // Load document names for all pages from the current view
  const { data: pages, error } = await supabase()
    .from('notion_database_pages_current')
    .select('notion_page_id, plain_text_name');

  if (error) {
    console.error('Error loading document names:', error);
  }

  // Create lookup map: UUID → document name
  const documentLookup = new Map<string, string>();
  if (pages) {
    for (const page of pages) {
      if (page.notion_page_id && page.plain_text_name) {
        documentLookup.set(page.notion_page_id, page.plain_text_name);
      }
    }
  }

  return (
    <div className="min-h-screen overflow-x-hidden bg-slate-100 p-6 pb-12">
      <Content initialMappings={mappings} documentLookup={Object.fromEntries(documentLookup)} />
    </div>
  );
}
