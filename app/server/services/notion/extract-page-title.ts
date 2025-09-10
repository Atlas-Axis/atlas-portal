import { PageObjectResponse } from '@notionhq/client';
import { Json } from '@/app/server/services/supabase/database.types';

export function extractPageTitle(
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

    if ('rich_text' in property && Array.isArray(property.rich_text) && property.rich_text.length > 0) {
      return {
        plainText: property.rich_text.map((text) => text.plain_text).join('') || null,
        richText: property.rich_text,
      };
    }

    if ('formula' in property && property.formula?.type === 'string' && property.formula.string) {
      return {
        plainText: property.formula.string,
        richText: null, // Formula properties don't have rich text formatting
      };
    }

    console.warn(
      `Property "${titlePropertyName}" in page ${page.id} is not a rich_text or formula property or is empty.`,
    );
    return { plainText: null, richText: null };
  } catch (error) {
    console.error(`Error extracting title from page ${page.id}:`, error);
    return { plainText: null, richText: null };
  }
}
