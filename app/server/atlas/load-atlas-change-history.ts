import { PostgrestError } from '@supabase/supabase-js';
import { NotionDatabasePage } from '@/app/server/database/notion-database-page';
import { supabase } from '@/app/server/services/supabase/supabase-client';

const LIMIT = 200;

export type AtlasPageChangeType = 'new' | 'deleted' | 'changed';

export type AtlasPageChange = {
  type: AtlasPageChangeType;
  oldPage: NotionDatabasePage | null;
  newPage: NotionDatabasePage | null;
  changes: {
    properties: {
      [key: string]: {
        oldValue: string;
        newValue: string;
      };
    };
  };
};

export const CHILD_FIELDS: Array<keyof NotionDatabasePage> = [
  'child_scope_ids',
  'child_article_ids',
  'child_section_and_primary_doc_ids',
  'child_annotation_ids',
  'child_tenet_ids',
  'child_scenario_ids',
  'child_scenario_variation_ids',
  'child_active_data_ids',
  'child_agent_scope_ids',
  'child_needed_research_ids',
];

export async function loadAtlasChangeHistory(params?: { since?: Date | string }): Promise<AtlasPageChange[]> {
  type RpcRow = {
    notion_page_id: string;
    event_time: string;
    event_type: AtlasPageChangeType;
    old_row: NotionDatabasePage | null;
    new_row: NotionDatabasePage | null;
  };

  const client = supabase() as unknown as {
    rpc<T>(fn: string, args?: Record<string, unknown>): Promise<{ data: T | null; error: PostgrestError | null }>;
  };
  const { data, error } = await client.rpc<RpcRow[]>('public_get_atlas_page_changes', { p_limit: LIMIT });

  if (error) {
    console.error({ error });
    throw new Error(`Failed to load Atlas change history: ${error.message}`, { cause: error });
  }

  let rows = (data ?? []) as RpcRow[];

  // Optional in-memory filter by event_time
  if (params?.since) {
    const sinceTs = new Date(params.since).getTime();
    if (!Number.isNaN(sinceTs)) {
      rows = rows.filter((r) => {
        const eventTs = new Date(r.event_time).getTime();
        return !Number.isNaN(eventTs) && eventTs >= sinceTs;
      });
    }
  }

  function computeChanges(oldPage: NotionDatabasePage | null, newPage: NotionDatabasePage | null) {
    const properties: Record<string, { oldValue: string; newValue: string }> = {};
    if (!oldPage || !newPage) return { properties };

    // Helpers
    const isPlainObject = (v: unknown): v is Record<string, unknown> =>
      typeof v === 'object' && v !== null && !Array.isArray(v);

    const stringifyStable = (v: unknown): string => {
      if (Array.isArray(v)) {
        const asStrings = v.map((x) => String(x));
        asStrings.sort();
        return JSON.stringify(asStrings);
      }
      if (isPlainObject(v)) {
        const keys = Object.keys(v).sort();
        const obj: Record<string, unknown> = {};
        for (const k of keys) obj[k] = (v as Record<string, unknown>)[k];
        return JSON.stringify(obj);
      }
      return v == null ? '' : String(v);
    };

    const shallowDifferentObjects = (a: unknown, b: unknown): boolean => {
      if (!isPlainObject(a) || !isPlainObject(b)) return a !== b;
      const aKeys = Object.keys(a).sort();
      const bKeys = Object.keys(b).sort();
      if (aKeys.length !== bKeys.length) return true;
      for (let i = 0; i < aKeys.length; i++) if (aKeys[i] !== bKeys[i]) return true;
      for (const k of aKeys) {
        const av = (a as Record<string, unknown>)[k];
        const bv = (b as Record<string, unknown>)[k];
        if (stringifyStable(av) !== stringifyStable(bv)) return true;
      }
      return false;
    };

    const fieldsToCompare: Array<keyof NotionDatabasePage> = [
      'plain_text_name',
      'plain_text_content',
      'atlas_document_number',
      'canonical_document_title',
      'parent_notion_page_id',
      // 'sort_order',
      'archived',
      'in_trash',
      'has_children',
      'atlas_document_type',
      'atlas_database_name',
    ];

    for (const field of fieldsToCompare) {
      const beforeVal = oldPage[field];
      const afterVal = newPage[field];
      if (beforeVal !== afterVal) {
        properties[String(field)] = {
          oldValue: beforeVal == null ? '' : String(beforeVal),
          newValue: afterVal == null ? '' : String(afterVal),
        };
      }
    }

    // Shallow compare extra_fields
    const extraBefore = oldPage.extra_fields;
    const extraAfter = newPage.extra_fields;
    if (shallowDifferentObjects(extraBefore, extraAfter)) {
      properties['extra_fields'] = {
        oldValue: stringifyStable(extraBefore),
        newValue: stringifyStable(extraAfter),
      };
    }

    const toSortedStringArray = (v: unknown): string[] => {
      if (!Array.isArray(v)) return [];
      const mapped = v.map((x) => String(x));
      mapped.sort();
      return mapped;
    };

    // Compare child relationship arrays (as sets of strings)
    for (const field of CHILD_FIELDS) {
      const beforeArr = toSortedStringArray(oldPage[field] as unknown);
      const afterArr = toSortedStringArray(newPage[field] as unknown);
      if (beforeArr.length !== afterArr.length || beforeArr.some((v, i) => v !== afterArr[i])) {
        // Compute only the differences to avoid very large payloads
        const beforeSet = new Set(beforeArr);
        const afterSet = new Set(afterArr);
        const removed: string[] = [];
        const added: string[] = [];
        for (const id of beforeSet) if (!afterSet.has(id)) removed.push(id);
        for (const id of afterSet) if (!beforeSet.has(id)) added.push(id);
        removed.sort();
        added.sort();

        properties[String(field)] = {
          // oldValue shows items that were removed
          oldValue: JSON.stringify(removed),
          // newValue shows items that were added
          newValue: JSON.stringify(added),
        };
      }
    }

    return { properties };
  }

  return rows.map((row) => {
    return {
      type: row.event_type,
      oldPage: (row.old_row as NotionDatabasePage | null) ?? null,
      newPage: (row.new_row as NotionDatabasePage | null) ?? null,
      changes:
        row.event_type === 'changed'
          ? computeChanges(
              (row.old_row as NotionDatabasePage | null) ?? null,
              (row.new_row as NotionDatabasePage | null) ?? null,
            )
          : { properties: {} },
    };
  });
}
