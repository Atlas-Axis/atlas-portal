
import { NotionDatabasePage } from "../../database/notion-database-page";
import { supabase } from "@/app/server/services/supabase/supabase-client";

export type AtlasPageChangeType = 'new' | 'deleted' | 'changed';

export type AtlasPageChange = {
  type: AtlasPageChangeType;
  page: NotionDatabasePage;
  changes: {
    properties: {
      [key: string]: {
        oldValue: string;
        newValue: string;
      };
    };
  };
};

export async function loadAtlasChangeHistory(): Promise<AtlasPageChange[]> {
  // 1) Fetch latest historical versions (represent edits or deletions)
  const { data, error } = await supabase()
    .from('notion_database_pages')
    .select('*')
    .not('date_valid_to', 'is', null)
    .order('date_valid_to', { ascending: false })
    .limit(100);

  if (error) {
    console.error({ error });
    throw new Error(`Failed to load Atlas change history: ${error.message}`, { cause: error });
  }

  const rows = (data ?? []) as NotionDatabasePage[];

  // 2) Fetch latest creations: current rows where date_valid_to IS NULL, ordered by recent date_valid_from
  const { data: recentCreations, error: recentCreationsError } = await supabase()
    .from('notion_database_pages')
    .select('*')
    .is('date_valid_to', null)
    .order('date_valid_from', { ascending: false })
    .limit(100);

  if (recentCreationsError) {
    console.error({ recentCreationsError });
    throw new Error(`Failed to load recent creations for change history: ${recentCreationsError.message}`, {
      cause: recentCreationsError,
    });
  }

  // Determine which of the historical pages currently exist (date_valid_to IS NULL)
  const notionPageIds = Array.from(new Set(rows.map(r => r.notion_page_id)));
  const { data: currentRows, error: currentError } = await supabase()
    .from('notion_database_pages')
    .select('notion_page_id')
    .is('date_valid_to', null)
    .in('notion_page_id', notionPageIds);

  if (currentError) {
    console.error({ currentError });
    throw new Error(`Failed to check current pages for change history: ${currentError.message}`, { cause: currentError });
  }

  const currentlyExisting = new Set((currentRows ?? []).map(r => r.notion_page_id as string));

  const historicalChanges: AtlasPageChange[] = rows.map((page) => ({
    // If the page has a current version, this historical row represents a change; otherwise, it's a deletion
    type: currentlyExisting.has(page.notion_page_id) ? 'changed' : 'deleted',
    page,
    changes: { properties: {} },
  }));

  const creations: AtlasPageChange[] = (recentCreations ?? []).map((page) => ({
    type: 'new',
    page: page as NotionDatabasePage,
    changes: { properties: {} },
  }));

  // Combine both, sort by their event timestamp (date_valid_to for historical, date_valid_from for creations)
  type WithTs = AtlasPageChange & { __ts: number };
  const toTs = (
    p: Pick<NotionDatabasePage, 'date_valid_to' | 'date_valid_from'>,
    key: 'date_valid_to' | 'date_valid_from',
  ): number => {
    const value = p[key];
    return value ? new Date(value).getTime() : 0;
  };

  const combined: WithTs[] = [
    ...historicalChanges.map((c) => ({ ...c, __ts: toTs(c.page, 'date_valid_to') })),
    ...creations.map((c) => ({ ...c, __ts: toTs(c.page, 'date_valid_from') })),
  ];

  combined.sort((a, b) => b.__ts - a.__ts);

  // Return top 100 (strip internal timestamp)
  return combined.slice(0, 100).map((c) => ({ type: c.type, page: c.page, changes: c.changes }));
}