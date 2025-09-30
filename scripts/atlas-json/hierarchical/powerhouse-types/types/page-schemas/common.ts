import { z } from 'zod';
import { Relation } from '../notion-data.js';

/**
 * Common data fields present in all Notion pages
 *
 * This schema defines the base structure for all Notion pages, including:
 * - Page metadata (ID, creation time, last edited time)
 * - Author information (creator and last editor)
 * - Parent database information
 * - Page URLs
 */
export const CommonPageData = z.object({
  object: z.string(),
  id: z.string(),
  created_time: z.string(),
  last_edited_time: z.string(),
  created_by: z.object({ object: z.string(), id: z.string() }),
  last_edited_by: z.object({ object: z.string(), id: z.string() }),
  parent: z.object({ type: z.string(), database_id: z.string() }),
  url: z.string(),
  public_url: z.string().nullish(),
});

/**
 * Common properties present in all Notion pages in our databases
 *
 * This schema defines properties that are present in all our Notion pages:
 * - Master Status: Relation to status pages
 */
export const CommonPageProperties = z.object({
  'Master Status': Relation,
});
