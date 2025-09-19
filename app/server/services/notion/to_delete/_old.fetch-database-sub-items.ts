import type { PageObjectResponse } from '@notionhq/client/build/src/api-endpoints';

export interface _delete_DatabaseSubItemTree {
  pagesById: Map<string, PageObjectResponse>;
  pageIdToSubPageIds: Map<string, string[]>;
  pageIdToParentId: Map<string, string | null>;
  roots: string[]; // pages with no parent
}
