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
  property: PageObjectResponse['properties'][string],
): string | number | boolean | null {
  switch (property.type) {
    case 'title':
      return property.title.map((text) => text.plain_text).join('');
    case 'rich_text':
      return property.rich_text.map((text) => text.plain_text).join('');
    case 'number':
      return property.number;
    case 'checkbox':
      return property.checkbox;
    case 'url':
      return property.url;
    case 'email':
      return property.email;
    case 'phone_number':
      return property.phone_number;
    case 'date':
      return property.date?.start || null;
    case 'select':
      return property.select?.name || null;
    case 'formula':
      if (property.formula.type === 'string') {
        return property.formula.string;
      } else if (property.formula.type === 'number') {
        return property.formula.number;
      } else if (property.formula.type === 'boolean') {
        return property.formula.boolean;
      } else if (property.formula.type === 'date') {
        return property.formula.date?.start || null;
      }
      return null;
    case 'rollup':
      // Rollups can contain various types - for simplicity, return null
      // You might want to handle specific rollup types based on your needs
      return null;
    case 'created_time':
      return property.created_time;
    case 'last_edited_time':
      return property.last_edited_time;
    case 'created_by':
      return property.created_by.id;
    case 'last_edited_by':
      return property.last_edited_by.id;
    case 'multi_select':
      return property.multi_select.map((option) => option.name).join(', ');
    case 'people':
      return property.people.map((person) => person.id).join(', ');
    case 'files':
      return property.files.length > 0 ? `${property.files.length} file(s)` : null;
    case 'relation':
      return property.relation.map((rel) => rel.id).join(', ');
    default:
      console.warn(`Unsupported property type: ${property.type}`);
      return null;
  }
}
