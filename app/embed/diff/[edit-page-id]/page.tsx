import { InlineTextDiff } from '@/app/components/inline-text-diff';
import { calculateNotionPageHierarchyChanges } from '@/app/server/services/diff/calculate-notion-page-changes';
import { getOriginalNotionPageIdForEditPage } from '@/app/server/services/supabase/get-original-notion-page-id-for-edit-page';
import { uuidToHyphens } from '@/app/shared/utils/utils';

export default async function Page({ params }: { params: { 'edit-page-id': string } }) {
  const { 'edit-page-id': editPageId } = await params;

  // If editPageId is missing, show an error message
  if (!editPageId) return <div>Error: Missing edit page ID</div>;

  // If editPageId doesn't have hyphens, call uuidToHyphens on it
  const formattedEditPageId = editPageId.includes('-') ? editPageId : uuidToHyphens(editPageId);

  const originalNotionPageId = await getOriginalNotionPageIdForEditPage(formattedEditPageId);
  const changes = await calculateNotionPageHierarchyChanges({
    originalRootNotionPageId: originalNotionPageId,
    duplicatedRootNotionPageId: formattedEditPageId,
  });

  return (
    <div>
      <h1 className="mb-3 text-2xl font-bold">Changes</h1>
      <pre>{JSON.stringify(changes, null, 2)}</pre>
      {/* <div>
        <InlineTextDiff
          newContent={`Lorem ipsum dolor sit amet, consectetur adipiscing elit.`}
          oldContent={`Lorem ipsum sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.`}
        />
      </div> */}
    </div>
  );
}
