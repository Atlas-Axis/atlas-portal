CREATE TABLE IF NOT EXISTS public.notion_nesting_bug_mapping (
  child_notion_page_id UUID NOT NULL,
  parent_notion_page_id UUID NOT NULL,
  atlas_database_name atlas_database_name_enum NOT NULL,
  child_label TEXT,
  parent_label TEXT,
  place_after_sibling_notion_page_id UUID,
  place_after_sibling_label TEXT,
  PRIMARY KEY (child_notion_page_id, parent_notion_page_id)
);

ALTER TABLE public.notion_nesting_bug_mapping ENABLE ROW LEVEL SECURITY;

