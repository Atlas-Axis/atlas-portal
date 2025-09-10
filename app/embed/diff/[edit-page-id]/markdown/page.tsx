import { _delete_calculateNotionPageHierarchyChanges } from '@/app/server/diff/to_delete/_old.calculate-notion-page-changes';
import { renderMarkdown } from '@/app/server/markdown/render';
import { getOriginalRootNotionPageIdForEditPage } from '@/app/server/services/supabase/get-original-notion-page-id-for-edit-page';
import { uuidToHyphens } from '@/app/shared/utils/utils';

export default async function Page({ params }: { params: { 'edit-page-id': string } }) {
  const { 'edit-page-id': editPageId } = await params;

  // If editPageId is missing, show an error message
  if (!editPageId) return <div>Error: Missing edit page ID</div>;

  // If editPageId doesn't have hyphens, call uuidToHyphens on it
  const formattedEditPageId = editPageId.includes('-') ? editPageId : uuidToHyphens(editPageId);

  const originalNotionRootPageId = await getOriginalRootNotionPageIdForEditPage(formattedEditPageId);
  const result = await _delete_calculateNotionPageHierarchyChanges({
    originalRootNotionPageId: originalNotionRootPageId,
    duplicatedRootNotionPageId: formattedEditPageId,
  });

  // Generate HTML output from Markdown edit proposal
  const htmlOutput = renderMarkdown(result.proposalMarkdown);

  return (
    <div className="mx-auto max-w-4xl space-y-9 p-6">
      <h1 className="mb-6 text-2xl font-bold text-gray-900">Changes</h1>

      <div
        className="prose h-full max-w-none overflow-auto rounded-lg border bg-white p-4"
        dangerouslySetInnerHTML={{ __html: htmlOutput }}
      />

      <div>
        {/* Debug view for Markdown source - remove in production or when embedded in Notion */}
        <details className="rounded bg-gray-100 p-4">
          <summary className="mb-2 cursor-pointer text-sm font-medium text-gray-600">Debug: Markdown Source</summary>
          <pre className="overflow-auto text-xs whitespace-pre-wrap text-gray-600">{result.proposalMarkdown}</pre>
        </details>

        {/* Debug view - remove in production or when embedded in Notion */}
        <details className="rounded bg-gray-100 p-4">
          <summary className="mb-2 cursor-pointer text-sm font-medium text-gray-600">Debug: Raw Changes Data</summary>
          <pre className="overflow-auto text-xs text-gray-600">{JSON.stringify(result, null, 2)}</pre>
        </details>
      </div>
    </div>
  );
}
