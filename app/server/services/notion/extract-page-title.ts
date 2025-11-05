import { PageObjectResponse } from '@notionhq/client';
import { Json } from '@/app/server/services/supabase/database.types';

/**
 * Extracts both plain text and rich text JSON from a Notion property.
 * For properties that support rich text formatting (rich_text, title), extracts both.
 * For properties without formatting (select, number), extracts only plain text.
 *
 * @param page - Notion page object
 * @param propertyName - Name of the property to extract
 * @returns Object with plainText and richText (richText is null for non-formatted properties)
 */
export function extractRichTextFromProperty(
  page: PageObjectResponse,
  propertyName: string,
): {
  plainText: string | null;
  richText: Json[] | null;
} {
  try {
    const property = page.properties[propertyName];
    if (!property) {
      console.warn(`Property "${propertyName}" not found in page ${page.id}`);
      return { plainText: null, richText: null };
    }

    // Handle rich_text properties (most common for extra fields)
    if ('rich_text' in property && Array.isArray(property.rich_text)) {
      return {
        plainText: property.rich_text.map((text) => text.plain_text).join(''),
        richText: property.rich_text,
      };
    }

    // Handle title properties (used for some properties)
    if ('title' in property && Array.isArray(property.title)) {
      return {
        plainText: property.title.map((text) => text.plain_text).join(''),
        richText: property.title, // Title properties also have rich text formatting
      };
    }

    // Handle select properties (no rich text formatting)
    if ('select' in property && property.select) {
      return {
        plainText: property.select.name,
        richText: null, // Select properties don't have rich text formatting
      };
    }

    // Handle number properties (no rich text formatting)
    if ('number' in property && property.number !== null) {
      return {
        plainText: String(property.number),
        richText: null, // Number properties don't have rich text formatting
      };
    }

    // Handle formula properties
    if ('formula' in property && property.formula?.type === 'string') {
      return {
        plainText: property.formula.string,
        richText: null, // Formula properties don't have rich text formatting
      };
    }

    console.warn(
      `Property "${propertyName}" in page ${page.id} is not a supported type (rich_text, title, select, number, formula) or is empty.`,
    );
    return { plainText: null, richText: null };
  } catch (error) {
    console.error(`Error extracting property "${propertyName}" from page ${page.id}:`, error);
    return { plainText: null, richText: null };
  }
}
