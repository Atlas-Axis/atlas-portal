// A function which reads a simple value from a Notion property, given the property type. Currently supports 'title', 'rich_text', 'formula', 'select', 'number', and 'url' types.
import { PageObjectResponse } from '@notionhq/client/build/src/api-endpoints';

/**
 * Examples of usage:
 * - For a 'title' property with title parts [{plain_text: 'Hello'}, {plain_text: ' World'}], it returns 'Hello World'.
 * - For a 'rich_text' property with rich text parts [{plain_text: 'This is '}, {plain_text: 'rich text'}], it returns 'This is rich text'.
 * - For a 'formula' property of type 'string' with value 'Formula Result', it returns 'Formula Result'.
 * - For a 'formula' property of type 'number' with value 42, it returns 42.
 * - For a 'formula' property of type 'boolean' with value true, it returns 1; if false, it returns 0.
 * - For a 'select' property with selected option {name: 'Option 1'}, it returns 'Option 1'.
 * - For a 'number' property with value 100, it returns 100.
 * - For a 'url' property with value 'https://example.com', it returns 'https://example.com'.
 *
 * If the property type is unsupported or the value is empty/null, it returns null.
 *
 * Note: This function does not handle complex property types like 'relation', 'multi_select', 'people', 'files', etc.
 * It is intended for simple value extraction only.
 *
 * @param property - A Notion page property object
 * @returns The extracted simple value (string or number) or null if not applicable
 */
export function readPlainTextValueFromNotionPageProperty(
  property: PageObjectResponse['properties']['string'],
): string | number | null {
  switch (property.type) {
    case 'title':
      return property.title.map((part) => part.plain_text).join('') || null;
    case 'rich_text':
      return property.rich_text.map((part) => part.plain_text).join('') || null;
    case 'formula':
      if (property.formula.type === 'string') return property.formula.string || null;
      if (property.formula.type === 'number') return property.formula.number !== null ? property.formula.number : null;
      if (property.formula.type === 'boolean') return property.formula.boolean ? 1 : 0;
      return null;
    case 'select':
      return property.select ? property.select.name : null;
    case 'number':
      return property.number !== null ? property.number : null;
    case 'url':
      return property.url || null;
    default:
      console.warn(`Unsupported property type: ${property.type}`);
      return null;
  }
}
