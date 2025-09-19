import { PageObjectResponse } from '@notionhq/client';
import { Json } from '@/app/server/services/supabase/database.types';

export function extractRichTextPlainText(
  page: PageObjectResponse,
  titlePropertyName: string,
): {
  plainText: string | null;
  richText: Json[] | null;
} {
  try {
    const property = page.properties[titlePropertyName];
    if (!property) {
      console.warn(`Property "${titlePropertyName}" not found in page ${page.id}`);
      return { plainText: null, richText: null };
    }

    // Handle rich_text properties (most common for titles)
    if ('rich_text' in property && Array.isArray(property.rich_text)) {
      return {
        plainText: property.rich_text.map((text) => text.plain_text).join(''),
        richText: property.rich_text,
      };
    }

    // Handle title properties (used for some document titles)
    if ('title' in property && Array.isArray(property.title)) {
      return {
        plainText: property.title.map((text) => text.plain_text).join(''),
        richText: property.title, // Title properties also have rich text formatting
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
      `Property "${titlePropertyName}" in page ${page.id} is not a rich_text, title, or formula property or is empty.`,
    );
    return { plainText: null, richText: null };
  } catch (error) {
    console.error(`Error extracting title from page ${page.id}:`, error);
    return { plainText: null, richText: null };
  }
}
