'use server';

import { calculateNotionPageHierarchyChanges } from '@/app/server/services/diff/calculate-notion-page-changes';

export async function loadChangeSetAction({
  originalRootNotionPageId,
  duplicatedRootNotionPageId,
}: {
  originalRootNotionPageId: string;
  duplicatedRootNotionPageId: string;
}) {
  return await calculateNotionPageHierarchyChanges({
    originalRootNotionPageId,
    duplicatedRootNotionPageId,
  });
}
