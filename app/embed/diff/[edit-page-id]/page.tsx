import { InlineTextDiff } from '@/app/components/inline-text-diff';
import { calculateNotionPageHierarchyChanges } from '@/app/server/services/diff/calculate-notion-page-changes';
import { getOriginalNotionPageIdForEditPage } from '@/app/server/services/supabase/get-original-notion-page-id-for-edit-page';

export default async function Page({ params }: { params: { 'edit-page-id': string } }) {
  const { 'edit-page-id': editPageId } = await params;

  const originalNotionPageId = await getOriginalNotionPageIdForEditPage(editPageId);
  const changes = await calculateNotionPageHierarchyChanges({
    originalRootNotionPageId: originalNotionPageId,
    duplicatedRootNotionPageId: editPageId,
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
