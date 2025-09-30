/* eslint-disable @typescript-eslint/no-explicit-any */
import type { RichTextItemResponse } from '@notionhq/client/build/src/api-endpoints';
import { z } from 'zod';
// import { makeAtlasDataHtmlDocument } from '../components/make-atlas-data-html-string';
import { agentArtifactsSectionId, masterStatusesIdMap } from '../constants';
import type {
  RawViewNode,
  RawViewNodeMap,
  TFiles,
  TProcessedFile,
  TProcessedNodeContentItem,
  TProcessedRichText,
  TProcessedRichTextItem,
  TProcessedSectionsById,
  TProcessedViewNodeContent,
  TSectionDocType,
  TSupportDocType,
  TTitleField,
  ViewNode,
  ViewNodeExtended,
  ViewNodeMap,
} from '../types/index';
import {
  RelationArray,
  SectionDocTypeSchema,
  SupportDocTypeSchema,
  type TProcessedRelations,
  type TRelation,
  type TRichTextField,
  type TSelect,
} from '../types/index';
import { convertToMarkdown } from './markdown-converter';

/**
 * Extracts text content from a title field
 * @param {TTitleField} titleField - The title field to process
 * @returns {TProcessedRichText} Filtered array of rich text items
 */
export function getTextFromTitle(titleField: TTitleField): TProcessedRichText {
  const title = titleField?.title ?? [];

  return title.filter((item) => item !== null && item !== undefined);
}

/**
 * Extracts content from a rich text field
 * @param {TRichTextField} richTextField - The rich text field to process
 * @returns {TProcessedRichText} Filtered array of rich text items
 */
export function getContentFromRichText(richTextField: TRichTextField): TProcessedRichText {
  const richText = richTextField?.rich_text ?? [];
  return richText.filter((item) => item !== null && item !== undefined);
}

/**
 * Converts an array of rich text items into a single string
 * @param {TProcessedRichText} richText - Array of rich text items
 * @returns {string} Concatenated plain text
 */
export function makeProcessedRichTextString(richText: TProcessedRichText) {
  return richText
    .map((item) => item.plain_text)
    .join(' ')
    .trim();
}

/**
 * Processes file objects into a simplified format
 * @param {TFiles} files - Files to process
 * @returns {TProcessedFile[]} Array of processed files
 */
export function getProcessedFiles(files: TFiles): TProcessedFile[] {
  if (!files?.files) return [];

  return files.files
    .map((file) => {
      if (file?.type === 'file') {
        if (!file.file?.url) return null;
        return {
          url: file.file.url,
        };
      }

      if (file?.type === 'external') {
        if (!file.external?.url) return null;
        return {
          url: file.external.url,
        };
      }

      return null;
    })
    .filter((file) => file !== null && file !== undefined);
}

/**
 * Extracts relations from a relation field
 * @param {TRelation} relation - The relation field to process
 * @returns {TProcessedRelations} Array of processed relations
 */
export function getRelations(relation: TRelation) {
  if (!relation) return [];

  const result = RelationArray.safeParse(relation.relation);

  if (!result.success) {
    return [];
  }

  return (result.data?.filter((r) => Boolean(r?.id)) ?? []) as TProcessedRelations;
}

/**
 * Extracts text from a select field
 * @param {TSelect} select - The select field to process
 * @returns {string} The selected value's name
 */
export function getTextFromSelect(select: TSelect) {
  return select?.select?.name ?? '';
}

/**
 * Creates a Zod schema for a record of items by ID
 * @template TSchema - The schema type
 * @param {TSchema} schema - The base schema to use
 * @returns {z.ZodType} A record schema
 */
export function makeSchemaById<TSchema extends z.ZodTypeAny>(schema: TSchema) {
  return z.record(z.string(), schema);
}

/**
 * Gets status names from status IDs using a lookup table
 * @param {string[]} masterStatusIds - Array of status IDs
 * @param {Record<string, string>} parsedMasterStatus - Lookup table of status IDs to names
 * @returns {string[]} Array of status names
 */
export function getMasterStatusNames(masterStatusIds: string[], parsedMasterStatus: Record<string, string>): string[] {
  return masterStatusIds.map((id) => parsedMasterStatus[id]);
}

/**
 * Gets the master status name from a master status ID
 * @param {string} masterStatusId - The master status ID
 * @returns {string | null} The master status name or null if the ID is not found
 */
export function getMasterStatusName(masterStatusId?: string): string | null {
  if (!masterStatusId) return null;

  return masterStatusesIdMap[masterStatusId] ?? null;
}

/**
 * Extracts IDs from an array of relations
 * @param {any[]} relations - Array of relations
 * @returns {string[]} Array of IDs
 */
export function getIds(relations: any[]): string[] {
  // eslint-disable-next-line @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-member-access
  return relations?.map((r) => r?.id) ?? [];
}

/**
 * Creates HTML documents for each node in the view node map
 * @param {ViewNodeMap} viewNodeMap - Map of view nodes
 * @returns {Promise<Record<string, string>>} Map of node IDs to HTML strings
 */
// export async function makeHtmlDocumentViewNodeMap(viewNodeMap: ViewNodeMap) {
//   const htmlStringViewNodeMap: Record<string, string> = {};
//   for (const slugSuffix in viewNodeMap) {
//     const viewNode = viewNodeMap[slugSuffix]!;
//     htmlStringViewNodeMap[slugSuffix] = await makeAtlasDataHtmlDocument([viewNode]);
//   }
//   return htmlStringViewNodeMap;
// }

/**
 * Processes a raw view node map into a processed view node map
 * @param {RawViewNodeMap} rawViewNodeMap - Raw view node map to process
 * @param {Record<string, string>} slugLookup - Lookup table for slugs
 * @param {ViewNodeMap} [viewNodeMap={}] - Optional existing view node map to update
 * @returns {ViewNodeMap} Processed view node map
 */
export async function processRawViewNodeMap(
  rawViewNodeMap: RawViewNodeMap,
  slugLookup: Record<string, string>,
  viewNodeMap: ViewNodeMap = {},
): Promise<ViewNodeMap> {
  for (const slugSuffix in rawViewNodeMap) {
    const rawNode = rawViewNodeMap[slugSuffix];
    if (rawNode) {
      await processRawViewNode(rawNode, slugLookup, rawViewNodeMap, viewNodeMap);
    }
  }
  return viewNodeMap;
}

/**
 * Processes a raw view node into a processed view node
 * @param {RawViewNode} node - Raw view node to process
 * @param {Record<string, string>} slugLookup - Lookup table for slugs
 * @param {RawViewNodeMap} rawViewNodeMap - Raw view node map
 * @param {ViewNodeMap} viewNodeMap - View node map to update
 * @returns {ViewNode} Processed view node
 */
async function processRawViewNode(
  node: RawViewNode,
  slugLookup: Record<string, string>,
  rawViewNodeMap: RawViewNodeMap,
  viewNodeMap: ViewNodeMap,
): Promise<ViewNodeExtended> {
  // Avoid processing the same node multiple times
  if (viewNodeMap[node.slugSuffix]) {
    return viewNodeMap[node.slugSuffix]!;
  }

  // Process content using the updated function
  const content = processContentForViewNode(node, rawViewNodeMap, slugLookup);
  const markdownContent = await processMarkdownContentForViewNode(node, rawViewNodeMap, slugLookup);

  // Recursively process subDocuments
  const subDocuments: ViewNodeExtended[] = [];
  if (node.subDocuments) {
    for (const subNode of node.subDocuments) {
      const processedSubNode = await processRawViewNode(subNode, slugLookup, rawViewNodeMap, viewNodeMap);
      subDocuments.push(processedSubNode);
    }
  }

  // Create the ViewNode, omitting specified properties and adding processed ones
  const { content: _, subDocuments: __, ...rest } = node;
  const viewNode: ViewNodeExtended = {
    ...rest,
    content,
    subDocuments,
    markdownContent,
  };

  // Add the processed node to the map
  viewNodeMap[node.slugSuffix] = viewNode;

  return viewNode;
}

/**
 * Processes content for a view node, including handling links and mentions
 *
 * This function processes the raw content of a view node, with special handling for:
 * - Links to other nodes (both internal and external)
 * - Mentions of other nodes
 * - Equations, code blocks, and tables
 * - Regular paragraphs
 *
 * For links and mentions, it:
 * 1. Extracts the target node ID from the URL or mention
 * 2. Looks up the target node in the view node map
 * 3. Creates a processed link/mention with the correct numbering and title
 *
 * @param {RawViewNode} node - Node to process content for
 * @param {RawViewNodeMap} rawViewNodeMap - Raw view node map
 * @param {Record<string, string>} slugLookup - Lookup table for slugs
 * @returns {TProcessedNodeContentItem[]} Processed content items
 */
function processContentForViewNode(
  node: RawViewNode,
  rawViewNodeMap: RawViewNodeMap,
  slugLookup: Record<string, string>,
): TProcessedNodeContentItem[] {
  const initialProcessedItems = node.content
    .map((contentItem) => {
      // Process the 'heading' field (preserve as is)
      const heading = contentItem.heading;

      let processedText: TProcessedViewNodeContent[] = [];

      // Process the 'text' field
      if (typeof contentItem.text === 'string') {
        if (contentItem.text.length > 0) {
          // Use LaTeX detection for string content
          processedText.push(...makeContentFromText(contentItem.text));
        }
      } else if (Array.isArray(contentItem.text)) {
        processedText = contentItem.text
          .map((item) => makeProcessedContentItem(item, rawViewNodeMap, slugLookup))
          .filter(Boolean) as TProcessedViewNodeContent[];
      }

      // **Only include items that have non-empty 'processedText'**
      if (processedText.length > 0) {
        return {
          heading,
          text: processedText,
        };
      } else {
        return null;
      }
    })
    .filter((item) => item !== null && item !== undefined);

  // Post-process to handle LaTeX expressions that span multiple content items
  return processLatexAcrossContentItems(initialProcessedItems);
}

/**
 * Processes LaTeX expressions that may span across multiple content items
 * This handles cases where block equations ($$...$$) are split across multiple paragraph items
 *
 * @param {TProcessedNodeContentItem[]} contentItems - Initial processed content items
 * @returns {TProcessedNodeContentItem[]} Content items with LaTeX properly detected and merged
 */
function processLatexAcrossContentItems(contentItems: TProcessedNodeContentItem[]): TProcessedNodeContentItem[] {
  const result: TProcessedNodeContentItem[] = [];

  for (const contentItem of contentItems) {
    // Only process content items that contain paragraph text
    const hasParagraphs = contentItem.text.some((item) => item.type === 'paragraphs');
    if (!hasParagraphs) {
      // No paragraphs to process, keep as-is
      result.push(contentItem);
      continue;
    }

    // Only merge adjacent paragraph items; keep others in place.
    const rebuiltText: TProcessedViewNodeContent[] = [];
    let pendingParagraphs: string[] = [];

    const flushPendingParagraphs = () => {
      if (pendingParagraphs.length === 0) return;
      const combined = pendingParagraphs.join('');
      const processed = combined.includes('$') ? makeContentFromText(combined) : [makeParagraphsContent(combined)];
      rebuiltText.push(...processed);
      pendingParagraphs = [];
    };

    for (const item of contentItem.text) {
      if (item.type === 'paragraphs') {
        pendingParagraphs.push(item.text);
      } else {
        // Before pushing a non-paragraph item, flush any accumulated paragraphs
        flushPendingParagraphs();
        rebuiltText.push(item);
      }
    }

    // Flush any remaining paragraphs at the end
    flushPendingParagraphs();

    result.push({
      heading: contentItem.heading,
      text: rebuiltText,
    });
  }

  return result;
}

/**
 * Creates a processed content item from a rich text item
 *
 * This function handles the conversion of raw rich text items into processed content,
 * with special handling for different content types:
 *
 * - Mentions: Converts Notion mentions to links with correct numbering
 * - Links: Processes both internal and external links
 * - Equations: Preserves equation content
 * - Code: Preserves code content with formatting
 * - Tables: Preserves table content
 * - Paragraphs: Handles regular text content
 *
 * For links and mentions, it ensures the correct numbering is used by looking up
 * the target node in the view node map and using its processed title.
 *
 * @param {TProcessedRichTextItem} richTextItem - Rich text item to process
 * @param {RawViewNodeMap} viewNodeMap - View node map for looking up target nodes
 * @param {Record<string, string>} slugLookup - Lookup table for slugs
 * @returns {TProcessedViewNodeContent | null} Processed content item or null
 */
function makeProcessedContentItem(
  richTextItem: TProcessedRichTextItem,
  viewNodeMap: RawViewNodeMap,
  slugLookup: Record<string, string>,
): TProcessedViewNodeContent | null {
  if (richTextItem.type === 'mention' && richTextItem.mention?.page?.id && richTextItem.plain_text?.length) {
    return makeMentionContent(
      richTextItem.mention?.page?.id,
      richTextItem.plain_text,
      richTextItem.text?.link?.url,
      viewNodeMap,
      slugLookup,
    );
  }

  if (richTextItem.type === 'text' && richTextItem.text?.link?.url && richTextItem.plain_text?.length) {
    return makeLinkContent(richTextItem.text?.link?.url, richTextItem.plain_text, viewNodeMap, slugLookup);
  }

  if (richTextItem.type === 'equation' && richTextItem.plain_text?.length) {
    return makeEquationContent(richTextItem.plain_text, 'block');
  }

  if (richTextItem.annotations?.code && richTextItem.plain_text?.length) {
    return makeCodeContent(richTextItem.plain_text);
  }

  if (richTextItem.plain_text?.includes('----') && richTextItem.plain_text?.length) {
    return makeTableContent(richTextItem.plain_text);
  }

  if (richTextItem.plain_text?.length) {
    return makeParagraphsContent(richTextItem.plain_text);
  }

  return null;
}

/**
 * Processes the raw content of a view node into a markdown string
 *
 * @param {RawViewNode} node - Node to process raw content for
 * @returns {Promise<string>} Markdown string
 */
async function processMarkdownContentForViewNode(
  node: RawViewNode,
  rawViewNodeMap: RawViewNodeMap,
  slugLookup: Record<string, string>,
): Promise<string> {
  const richText = node.rawContent;
  if (!richText || !Array.isArray(richText)) {
    return '';
  }

  const processedRichText = richText.map((item: RichTextItemResponse) => {
    if (item.type === 'mention') {
      let node;

      if (item.mention.type === 'page') {
        const pageId = item.mention.page.id;
        const slug = getSlugWithSuffix(pageId ?? '', slugLookup);
        node = rawViewNodeMap[slug];
      }

      if (node) {
        const text = `[${makeViewNodeTitleText(node)}](${makeViewNodeUrl(node)})`;

        return {
          type: 'text' as const,
          text: {
            content: text,
            link: null,
          },
          annotations: {
            ...item.annotations,
          },
          plain_text: text,
          href: null,
        };
      }
    }

    return item;
  });

  return await convertToMarkdown(processedRichText);
}

/**
 * Detects and processes LaTeX mathematical expressions in text
 *
 * Recognizes patterns:
 * - Block equations: $$...$$
 * - Inline equations: $...$
 *
 * @param {string} text - Text that may contain LaTeX expressions
 * @returns {TProcessedViewNodeContent[]} Array of processed content items (paragraphs and equations)
 */
function detectAndProcessLatexInText(text: string): TProcessedViewNodeContent[] {
  if (!text) {
    return [];
  }

  const result: TProcessedViewNodeContent[] = [];
  let position = 0;

  while (position < text.length) {
    // Look for block equations first ($$...$$)
    const blockMatch = text.slice(position).match(/\$\$([\s\S]*?)\$\$/);

    // Look for inline equations ($...$) but exclude escaped ones (\$) and block delimiters
    const inlineMatch = text
      .slice(position)
      .match(/(?<!\\)(?<=^|[^\w$])\$(?!\$)(?![\d\s])((?:[^$\\]|\\.)*?)(?<!\\)\$(?!\$)(?=$|[^\w$])/);

    let nextMatch: { type: 'block' | 'inline'; match: RegExpMatchArray; content: string } | null = null;

    // Determine which match comes first
    if (blockMatch && inlineMatch) {
      if (blockMatch.index! < inlineMatch.index!) {
        nextMatch = { type: 'block', match: blockMatch, content: blockMatch[1].trim() };
      } else {
        nextMatch = { type: 'inline', match: inlineMatch, content: inlineMatch[1].trim() };
      }
    } else if (blockMatch) {
      nextMatch = { type: 'block', match: blockMatch, content: blockMatch[1].trim() };
    } else if (inlineMatch) {
      nextMatch = { type: 'inline', match: inlineMatch, content: inlineMatch[1].trim() };
    }

    if (!nextMatch) {
      // No more LaTeX expressions, add remaining text as paragraph
      const remainingText = text.slice(position).trim();
      if (remainingText) {
        result.push(makeParagraphsContent(remainingText));
      }
      break;
    }

    // Add text before the LaTeX expression as paragraph
    const beforeText = text.slice(position, position + nextMatch.match.index!).trim();
    if (beforeText) {
      result.push(makeParagraphsContent(beforeText));
    }

    // Add the LaTeX expression as equation
    if (nextMatch.content) {
      result.push(makeEquationContent(nextMatch.content, nextMatch.type));
    }

    // Move position past the current match
    position += nextMatch.match.index! + nextMatch.match[0].length;
  }

  return result.filter((item) => item.text.trim().length > 0);
}

/**
 * Creates content items from text, detecting and processing LaTeX expressions
 * @param {string} text - Text content that may contain LaTeX
 * @returns {TProcessedViewNodeContent[]} Array of processed content items
 */
function makeContentFromText(text: string): TProcessedViewNodeContent[] {
  // Check if text contains LaTeX expressions
  if (text.includes('$')) {
    return detectAndProcessLatexInText(text);
  }

  // No LaTeX found, return as regular paragraph
  return [makeParagraphsContent(text)];
}

/**
 * Creates a paragraphs content item
 * @param {string} text - Text content
 * @returns {TProcessedViewNodeContent} Paragraphs content item
 */
function makeParagraphsContent(text: string) {
  return {
    type: 'paragraphs',
    text,
  } as const;
}

/**
 * Creates a code content item
 * @param {string} text - Code content
 * @returns {TProcessedViewNodeContent} Code content item
 */
function makeCodeContent(text: string) {
  return {
    type: 'code',
    text,
  } as const;
}

/**
 * Creates a table content item
 * @param {string} text - Table content
 * @returns {TProcessedViewNodeContent} Table content item
 */
function makeTableContent(text: string) {
  return {
    type: 'table',
    text,
  } as const;
}

/**
 * Creates an equation content item
 * @param {string} text - Equation content (without LaTeX delimiters)
 * @param {"inline" | "block"} variant - Equation type for KaTeX rendering
 * @returns {TProcessedViewNodeContent} Equation content item
 */
function makeEquationContent(text: string, variant: 'inline' | 'block' = 'inline') {
  return {
    type: 'equation',
    variant,
    text,
  } as const;
}

/**
 * Creates a link content item
 *
 * Processes a link to either:
 * 1. An internal node (using the processed node's title and URL)
 * 2. An external URL (preserving the original link)
 *
 * For internal links, it:
 * 1. Extracts the target node ID from the URL
 * 2. Looks up the target node in the view node map
 * 3. Uses the processed node's title and URL
 *
 * @param {string} href - Link URL
 * @param {string} text - Link text
 * @param {RawViewNodeMap} viewNodeMap - View node map for looking up target nodes
 * @param {Record<string, string>} slugLookup - Lookup table for slugs
 * @returns {TProcessedViewNodeContent} Link content item
 */
function makeLinkContent(href: string, text: string, viewNodeMap: RawViewNodeMap, slugLookup: Record<string, string>) {
  const pageIdFromUrl = formatNotionIdFromUrl(href);
  const slug = getSlugWithSuffix(pageIdFromUrl ?? '', slugLookup);
  const node = viewNodeMap[slug];

  if (node) {
    const href = makeViewNodeUrl(node);
    const title = makeViewNodeTitleText(node);

    return {
      type: 'link',
      text: title,
      href,
      external: false,
    } as const;
  }

  return {
    type: 'link',
    text,
    href,
    external: true,
  } as const;
}

/**
 * Creates a mention content item
 *
 * Processes a Notion mention to:
 * 1. Look up the mentioned node in the view node map
 * 2. Use the processed node's title and URL
 * 3. Fall back to the original text and URL if the node isn't found
 *
 * @param {string} id - Mentioned page ID
 * @param {string} text - Mention text
 * @param {string | null | undefined} url - Mention URL
 * @param {RawViewNodeMap} viewNodeMap - View node map for looking up target nodes
 * @param {Record<string, string>} slugLookup - Lookup table for slugs
 * @returns {TProcessedViewNodeContent} Mention content item
 */
function makeMentionContent(
  id: string,
  text: string,
  url: string | null | undefined,
  viewNodeMap: RawViewNodeMap,
  slugLookup: Record<string, string>,
) {
  const slugWithSuffix = getSlugWithSuffix(id, slugLookup);
  const node = viewNodeMap[slugWithSuffix];
  const href = node ? makeViewNodeUrl(node) : (url ?? '');
  const title = node ? makeViewNodeTitleText(node) : text;
  return {
    type: 'mention',
    text: title,
    href,
  } as const;
}

/**
 * Gets a slug with suffix for a given ID
 * @param {string} id - Node ID
 * @param {Record<string, string>} slugLookup - Lookup table for slugs
 * @returns {string} Slug with suffix
 */
export function getSlugWithSuffix(id: string, slugLookup: Record<string, string>) {
  const slugFromLookup = slugLookup[id];
  const hasSlugFromLookup = !!slugFromLookup;

  if (!hasSlugFromLookup) {
    return id;
  }

  return `${id}|${slugFromLookup}`;
}

/**
 * Creates a URL for a view node
 * @param {ViewNode | RawViewNode} node - Node to create URL for
 * @returns {string} Node URL
 */
export function makeViewNodeUrl(node: ViewNode | RawViewNode) {
  const titleSlug = makeViewNodeTitleSlug(node);
  return `/${titleSlug}/${node.slugSuffix}`;
}

/**
 * Creates a title slug for a view node
 * @param {ViewNode | RawViewNode} node - Node to create slug for
 * @returns {string} Title slug
 */
export function makeViewNodeTitleSlug(node: ViewNode | RawViewNode) {
  return makeViewNodeTitleText(node).replaceAll(/[- _/]+/g, '_');
}

/**
 * Creates a title text for a view node
 * @param {ViewNode | RawViewNode} node - Node to create title for
 * @returns {string} Title text
 */
export function makeViewNodeTitleText(node: ViewNode | RawViewNode): string {
  const { formalId, title, typeSuffix } = node.title;
  const { prefix, numberPath } = formalId;
  const path = [prefix, ...numberPath].join('.');
  const typeSuffixString = typeSuffix ? ` - ${typeSuffix}` : '';

  return `${path} - ${title}${typeSuffixString}`;
}

/**
 * Extracts a Notion ID from a URL
 * @param {string | null | undefined} url - URL to extract ID from
 * @returns {string | null} Extracted ID or null
 */
export function formatNotionIdFromUrl(url: string | null | undefined): string | null {
  if (!url) {
    return null;
  }
  // Check if the URL is a valid Notion link containing an ID
  const notionRegex = /^https:\/\/www\.notion\.so\/.+-([a-fA-F0-9]{32})$/;
  const match = notionRegex.exec(url);

  if (match) {
    // Extract the ID and format it
    const uuidWithoutDashes = match[1];
    return formatUUID(uuidWithoutDashes);
  }

  // Return null if the URL is not a valid Notion link
  return null;
}

/**
 * Formats a UUID string
 * @param {string} uuid - UUID string to format
 * @returns {string} Formatted UUID
 */
export function formatUUID(uuid: string): string {
  if (uuid.length !== 32) {
    throw new Error('Invalid UUID string length');
  }

  return `${uuid.substring(0, 8)}-${uuid.substring(8, 12)}-${uuid.substring(
    12,
    16,
  )}-${uuid.substring(16, 20)}-${uuid.substring(20)}`;
}

/**
 * Creates an Atlas ID for a view node. This is the number that appears in the Atlas Explorer.
 * @param {ViewNode} node - Node to create ID for
 * @returns {string} Atlas ID
 */
export function makeViewNodeAtlasId(node: ViewNode) {
  const { formalId } = node.title;
  const { prefix, numberPath } = formalId;
  return `${prefix}.${numberPath.join('.')}`;
}

/**
 * Checks if a document type is a section type
 * @param {string} docType - Document type to check
 * @returns {boolean} Whether the type is a section type
 */
export function isSectionDocType(docType: string): docType is TSectionDocType {
  if (SectionDocTypeSchema.safeParse(docType).success) {
    return true;
  }

  return false;
}

/**
 * Checks if a document type is a support type
 * @param {string} docType - Document type to check
 * @param {TSupportDocType} docType - Document type to check
 * @returns {boolean} Whether the type is a support type
 */
export function isSupportDocType(docType: string): docType is TSupportDocType {
  if (SupportDocTypeSchema.safeParse(docType).success) {
    return true;
  }

  return false;
}

/**
 * Gets support documents from a node's subdocuments
 * @param {ViewNode} node - Node to get support documents from
 * @returns {ViewNode[]} Array of support documents
 */
export function getSupportDocs(node: ViewNode) {
  return node.subDocuments.filter((subDoc) => isSupportDocType(subDoc.type));
}

/**
 * Gets non-support documents from a node's subdocuments
 * @param {ViewNode} node - Node to get non-support documents from
 * @returns {ViewNode[]} Array of non-support documents
 */
export function getNonSupportDocs(node: ViewNode) {
  return node.subDocuments.filter((subDoc) => !isSupportDocType(subDoc.type));
}

/**
 * Processes agent-related sections from the agents database
 *
 * The agents database contains sections that follow special naming and numbering rules.
 * This function:
 * 1. Identifies agent artifacts and sky primitives
 * 2. Updates section relationships
 * 3. Adds special flags to sections
 *
 * @param {TProcessedSectionsById} processedSectionsById - Processed sections from main database
 * @param {TProcessedSectionsById} processedAgentsById - Processed sections from agents database
 * @returns {TProcessedSectionsById} Combined and processed sections
 */
export function handleAgents(
  processedSectionsById: TProcessedSectionsById,
  processedAgentsById: TProcessedSectionsById,
) {
  const agents = Object.values(processedAgentsById);
  const agentArtifactIds = agents
    .filter((page) => page.parents.some((parent) => parent.id === agentArtifactsSectionId))
    .map((page) => page.id);
  const listsOfSkyPrimitiveListsIds = agents
    .filter((agent) => agent.nameString.toLowerCase() === 'sky primitives')
    .map((page) => page.id);
  const skyPrimitiveListIds = agents
    .filter((agent) => agent.parents.some((parent) => listsOfSkyPrimitiveListsIds.includes(parent.id)))
    .map((page) => page.id);

  const sectionsWithAgents = {
    ...processedSectionsById,
    ...processedAgentsById,
  };

  for (const section of Object.values(sectionsWithAgents)) {
    if (section.id === agentArtifactsSectionId) {
      section.children.push(...agentArtifactIds.map((id) => ({ id })));
    }
    section.isAgentArtifact = agentArtifactIds.includes(section.id);
    section.isSkyPrimitive = section.parents.some((parent) => skyPrimitiveListIds.includes(parent.id));
  }

  return sectionsWithAgents;
}
