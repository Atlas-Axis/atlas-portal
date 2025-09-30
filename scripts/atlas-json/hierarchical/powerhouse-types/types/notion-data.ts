import {
  type DatabaseObjectResponse,
  type PageObjectResponse,
  type PartialDatabaseObjectResponse,
  type PartialPageObjectResponse,
} from '@notionhq/client/build/src/api-endpoints';
import { z } from 'zod';
import { type AtlasPageName } from './processed-data';

/**
 * Schema for Notion formula fields that return string values
 */
export const StringFormula = z.object({
  type: z.literal('formula'),
  formula: z
    .object({
      type: z.literal('string'),
      string: z.string().nullish(),
    })
    .nullish(),
});

export type TStringFormula = z.infer<typeof StringFormula>;

/**
 * Schema for Notion relation fields, which contain arrays of page references
 * Notion relations can be nullish and can contain other weird stuff, so we normalize them to an array of objects with an `id` field during processing
 */
export const RelationArray = z.array(z.object({ id: z.string().nullish() }).nullish()).nullish();

/**
 * Schema for text formatting annotations in Notion rich text
 * Includes bold, italic, strikethrough, underline, code, and color
 * Currently these are not used in the Atlas, but we keep them for now in case we need them in the future
 */
export const RichTextAnnotations = z
  .object({
    bold: z.boolean().nullish(),
    italic: z.boolean().nullish(),
    strikethrough: z.boolean().nullish(),
    underline: z.boolean().nullish(),
    code: z.boolean().nullish(),
    color: z.string().nullish(),
  })
  .nullish();

export type TRichTextAnnotations = z.infer<typeof RichTextAnnotations>;

/**
 * Schema for Notion rich text content
 *
 * Notion exposes the raw data type that they use internally. That means there is a ton of stuff in here, almost none of which are relevant to us.
 *
 * You can see the full definition here https://developers.notion.com/reference/page-property-values#rich-text
 *
 * For our purposes, we use this schema to extract the parts we care about. These parts then are normalized into a type that is more general after processing.
 *
 * Note that there can be links in `text` items, which are different to `mention`s which also contain links. `mention`s are used internally by Notion to link to other pages, so the urls they contain are called 'page'. Since we want these to link to other parts of the Atlas explorer, we treat them as also being a type of link.
 */
export const RichText = z
  .object({
    type: z.union([z.literal('text'), z.literal('mention'), z.literal('equation')]),
    text: z
      .object({
        content: z.string().nullish(),
        link: z
          .object({
            url: z.string().nullish(),
          })
          .nullish(),
      })
      .nullish(),
    plain_text: z.string().nullish(),
    annotations: RichTextAnnotations,
    mention: z
      .object({
        type: z.string().nullish(),
        page: z
          .object({
            id: z.string().nullish(),
          })
          .nullish(),
      })
      .nullish(),
    equation: z
      .object({
        expression: z.string(),
      })
      .nullish(),
  })
  .nullish();

export type TRichText = z.infer<typeof RichText>;

/**
 * Schema for Notion rich text fields, which contain arrays of rich text content.
 *
 * Notion represents paragraphs as individual `rich_text` objects, but it also does this for items with special formatting, links, mentions, and other types. We cannot assume that a `rich_text` object is always a paragraph.
 */
export const RichTextField = z
  .object({
    rich_text: z.array(RichText).nullish(),
  })
  .nullish();

export type TRichTextField = z.infer<typeof RichTextField>;

/**
 * Schema for Notion title fields, which are special rich text fields
 *
 * Each page has a title field, which is a special rich text field that is intended to be the page's name. However, the Atlas data in Notion does not always use the title field for the page's name.
 */
export const TitleField = z
  .object({
    type: z.literal('title'),
    title: z.array(RichText).nullish(),
  })
  .nullish();

export type TTitleField = z.infer<typeof TitleField>;

/**
 * Schema for Notion relation fields, which link to other pages
 *
 * For our purposes, we only care about the `id` field of the relation.
 */
export const Relation = z
  .object({
    relation: RelationArray,
  })
  .nullish();
export type TRelation = z.infer<typeof Relation>;

/**
 * Schema for Notion select fields, which contain a single selected option
 */
export const Select = z
  .object({
    select: z
      .object({
        name: z.string().nullish(),
      })
      .nullish(),
  })
  .nullish();

export type TSelect = z.infer<typeof Select>;

/**
 * Schema for Notion file fields that contain uploaded files
 *
 * Notion distinguishes between uploaded files and external files. We only care about the `url` field of the file.
 */
export const File = z
  .object({
    type: z.literal('file'),
    file: z
      .object({
        url: z.string().nullish(),
      })
      .nullish(),
  })
  .nullish();

export type TFile = z.infer<typeof File>;

/**
 * Schema for Notion file fields that contain external file links
 */
export const ExternalFile = z
  .object({
    type: z.literal('external'),
    external: z
      .object({
        url: z.string().nullish(),
      })
      .nullish(),
  })
  .nullish();

export type TExternalFile = z.infer<typeof ExternalFile>;

/**
 * Schema for Notion files fields, which can contain both uploaded and external files
 *
 * Notion distinguishes between uploaded files and external files. We only care about the `url` field of the file, so we normalize them to an array of objects with an `url` field during processing.
 */
export const Files = z
  .object({
    id: z.string(),
    type: z.literal('files'),
    files: z.array(z.union([File, ExternalFile])).nullish(),
  })
  .nullish();

export type TFiles = z.infer<typeof Files>;

/**
 * Union type of all possible Notion API response types for database queries
 */
export type NotionDatabaseQueryResponse =
  | PageObjectResponse
  | PartialPageObjectResponse
  | PartialDatabaseObjectResponse
  | DatabaseObjectResponse;

/**
 * Type for the result of fetching Atlas pages from Notion
 * Maps page names to arrays of Notion page responses
 */
export type FetchAtlasNotionPagesResult = Record<AtlasPageName, NotionDatabaseQueryResponse[]>;
