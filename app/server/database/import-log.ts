export interface ImportLogCreateInput {
  success: boolean;
  has_changes: boolean;
  duration_minutes: number;
  finished_at: string;
  started_at: string;
  changed_notion_page_ids: string[];
  trigger_dev_run_id?: string | null;
  import_type: 'full_sync' | 'partial';
  error_message?: string | null;
  new_pages_count: number;
  deleted_pages_count: number;
  changed_properties_count: number;
  changed_relationships_count: number;
}
