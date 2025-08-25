export interface RichText {
  plain_text: string;
  annotations?: Record<string, unknown>;
  href?: string | null;
}

export interface NotionBlockContent {
  rich_text?: RichText[];
  title?: string;
  url?: string;
  caption?: RichText[];
  name?: string;
  [key: string]: unknown;
}

// Type returned by the `blocks/{block_id}` endpoint
export interface NotionBlock {
  id: string;
  parent_id: string | null;
  type: string;
  created_time: string;
  last_edited_time: string;
  has_children: boolean;
  archived: boolean;
  in_trash: boolean;
  last_edited_by: string | null;
  content: NotionBlockListItem;
  plain_text: string;
  position: number;
  page_id: string;
}

// Type returned by the `blocks/{block_id}/children` endpoint
export interface NotionBlockListItem {
  id: string;
  type: string;
  created_time: string;
  last_edited_time: string;
  has_children: boolean;
  archived: boolean;
  in_trash: boolean;
  last_edited_by?: { id: string } | null;
  [blockType: string]: NotionBlockContent | unknown;
}
