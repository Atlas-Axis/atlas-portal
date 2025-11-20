import { describe, expect, it } from 'vitest';
import { Json } from '@/app/server/services/supabase/database.types';
import { areJsonValuesEqual } from '../compare-json-content';

describe('areJsonValuesEqual', () => {
  describe('Primitive types', () => {
    it('should return true for identical strings', () => {
      expect(areJsonValuesEqual('hello', 'hello')).toBe(true);
    });

    it('should return false for different strings', () => {
      expect(areJsonValuesEqual('hello', 'world')).toBe(false);
    });

    it('should return true for identical numbers', () => {
      expect(areJsonValuesEqual(42, 42)).toBe(true);
      expect(areJsonValuesEqual(3.14, 3.14)).toBe(true);
    });

    it('should return false for different numbers', () => {
      expect(areJsonValuesEqual(42, 43)).toBe(false);
    });

    it('should return true for identical booleans', () => {
      expect(areJsonValuesEqual(true, true)).toBe(true);
      expect(areJsonValuesEqual(false, false)).toBe(true);
    });

    it('should return false for different booleans', () => {
      expect(areJsonValuesEqual(true, false)).toBe(false);
    });

    it('should return false for different primitive types', () => {
      expect(areJsonValuesEqual('42', 42)).toBe(false);
      expect(areJsonValuesEqual(true, 'true')).toBe(false);
      expect(areJsonValuesEqual(0, false)).toBe(false);
    });
  });

  describe('Null and undefined handling', () => {
    it('should return true for two null values', () => {
      expect(areJsonValuesEqual(null, null)).toBe(true);
    });

    it('should return false for null vs non-null', () => {
      expect(areJsonValuesEqual(null, 'value')).toBe(false);
      expect(areJsonValuesEqual('value', null)).toBe(false);
      expect(areJsonValuesEqual(null, 0)).toBe(false);
      expect(areJsonValuesEqual(null, false)).toBe(false);
    });

    it('should return true for two undefined values', () => {
      expect(areJsonValuesEqual(undefined, undefined)).toBe(true);
    });

    it('should return false for undefined vs defined', () => {
      expect(areJsonValuesEqual(undefined, 'value')).toBe(false);
      expect(areJsonValuesEqual('value', undefined)).toBe(false);
    });

    it('should return false for null vs undefined', () => {
      expect(areJsonValuesEqual(null, undefined)).toBe(false);
      expect(areJsonValuesEqual(undefined, null)).toBe(false);
    });
  });

  describe('Array comparison', () => {
    it('should return true for identical arrays', () => {
      expect(areJsonValuesEqual([1, 2, 3], [1, 2, 3])).toBe(true);
      expect(areJsonValuesEqual(['a', 'b'], ['a', 'b'])).toBe(true);
    });

    it('should return false for arrays with different lengths', () => {
      expect(areJsonValuesEqual([1, 2], [1, 2, 3])).toBe(false);
    });

    it('should return false for arrays with different values', () => {
      expect(areJsonValuesEqual([1, 2, 3], [1, 2, 4])).toBe(false);
    });

    it('should return false for arrays with same values in different order', () => {
      expect(areJsonValuesEqual([1, 2, 3], [3, 2, 1])).toBe(false);
    });

    it('should return true for empty arrays', () => {
      expect(areJsonValuesEqual([], [])).toBe(true);
    });

    it('should return false for array vs non-array', () => {
      expect(areJsonValuesEqual([1, 2], 'not array')).toBe(false);
      expect(areJsonValuesEqual('not array', [1, 2])).toBe(false);
    });

    it('should handle nested arrays', () => {
      expect(
        areJsonValuesEqual(
          [
            [1, 2],
            [3, 4],
          ],
          [
            [1, 2],
            [3, 4],
          ],
        ),
      ).toBe(true);
      expect(
        areJsonValuesEqual(
          [
            [1, 2],
            [3, 4],
          ],
          [
            [1, 2],
            [3, 5],
          ],
        ),
      ).toBe(false);
    });
  });

  describe('Object comparison', () => {
    it('should return true for identical objects', () => {
      expect(areJsonValuesEqual({ a: 1, b: 2 }, { a: 1, b: 2 })).toBe(true);
    });

    it('should return true for empty objects', () => {
      expect(areJsonValuesEqual({}, {})).toBe(true);
    });

    it('should return false for objects with different keys', () => {
      expect(areJsonValuesEqual({ a: 1 }, { b: 1 })).toBe(false);
    });

    it('should return false for objects with different values', () => {
      expect(areJsonValuesEqual({ a: 1 }, { a: 2 })).toBe(false);
    });

    it('should return false for objects with different number of keys', () => {
      expect(areJsonValuesEqual({ a: 1 }, { a: 1, b: 2 })).toBe(false);
    });

    it('should handle nested objects', () => {
      expect(areJsonValuesEqual({ a: { b: 1 } }, { a: { b: 1 } })).toBe(true);
      expect(areJsonValuesEqual({ a: { b: 1 } }, { a: { b: 2 } })).toBe(false);
    });

    it('should handle objects with null values', () => {
      expect(areJsonValuesEqual({ a: null }, { a: null })).toBe(true);
      expect(areJsonValuesEqual({ a: null }, { a: 'value' })).toBe(false);
    });

    it('should handle objects with undefined values as null', () => {
      const obj1 = { a: undefined };
      const obj2 = { a: null };
      // undefined gets normalized to null in comparison
      expect(areJsonValuesEqual(obj1, obj2)).toBe(true);
    });
  });

  describe('Notion rich text mention structures', () => {
    it('should detect different mention page IDs', () => {
      const mention1: Json = {
        type: 'mention',
        mention: {
          type: 'page',
          page: { id: '12345678-1234-1234-1234-123456789abc' },
        },
        plain_text: 'A.1.3 - General Provisions',
      };

      const mention2: Json = {
        type: 'mention',
        mention: {
          type: 'page',
          page: { id: '87654321-4321-4321-4321-cba987654321' },
        },
        plain_text: 'A.1.3 - General Provisions', // Same label, different ID
      };

      expect(areJsonValuesEqual(mention1, mention2)).toBe(false);
    });

    it('should return true for identical mention objects', () => {
      const mention: Json = {
        type: 'mention',
        mention: {
          type: 'page',
          page: { id: '12345678-1234-1234-1234-123456789abc' },
        },
        plain_text: 'A.1.3 - General Provisions',
      };

      expect(areJsonValuesEqual(mention, mention)).toBe(true);
      expect(areJsonValuesEqual(mention, JSON.parse(JSON.stringify(mention)))).toBe(true);
    });
  });

  describe('Notion rich text formatting', () => {
    it('should detect different text annotations', () => {
      const text1: Json = {
        type: 'text',
        text: { content: 'Hello' },
        annotations: { bold: true, italic: false },
        plain_text: 'Hello',
      };

      const text2: Json = {
        type: 'text',
        text: { content: 'Hello' },
        annotations: { bold: false, italic: true },
        plain_text: 'Hello',
      };

      expect(areJsonValuesEqual(text1, text2)).toBe(false);
    });

    it('should detect added/removed formatting', () => {
      const text1: Json = {
        type: 'text',
        text: { content: 'Hello' },
        annotations: { bold: false },
        plain_text: 'Hello',
      };

      const text2: Json = {
        type: 'text',
        text: { content: 'Hello' },
        annotations: { bold: true },
        plain_text: 'Hello',
      };

      expect(areJsonValuesEqual(text1, text2)).toBe(false);
    });

    it('should return true for identical formatted text', () => {
      const text: Json = {
        type: 'text',
        text: { content: 'Hello World' },
        annotations: {
          bold: true,
          italic: false,
          strikethrough: false,
          underline: false,
          code: false,
          color: 'default',
        },
        plain_text: 'Hello World',
      };

      expect(areJsonValuesEqual(text, JSON.parse(JSON.stringify(text)))).toBe(true);
    });
  });

  describe('Complex nested structures', () => {
    it('should handle rich text arrays with mixed content', () => {
      const richText1: Json = [
        { type: 'text', text: { content: 'Hello ' }, plain_text: 'Hello ' },
        {
          type: 'mention',
          mention: { type: 'page', page: { id: 'page-123' } },
          plain_text: 'Document',
        },
        { type: 'text', text: { content: ' world' }, plain_text: ' world' },
      ];

      const richText2: Json = [
        { type: 'text', text: { content: 'Hello ' }, plain_text: 'Hello ' },
        {
          type: 'mention',
          mention: { type: 'page', page: { id: 'page-456' } }, // Different ID
          plain_text: 'Document',
        },
        { type: 'text', text: { content: ' world' }, plain_text: ' world' },
      ];

      expect(areJsonValuesEqual(richText1, richText2)).toBe(false);
    });

    it('should handle deeply nested structures', () => {
      const deep1: Json = {
        level1: {
          level2: {
            level3: {
              level4: {
                value: 'deep',
              },
            },
          },
        },
      };

      const deep2: Json = {
        level1: {
          level2: {
            level3: {
              level4: {
                value: 'deep',
              },
            },
          },
        },
      };

      expect(areJsonValuesEqual(deep1, deep2)).toBe(true);

      const deep3: Json = {
        level1: {
          level2: {
            level3: {
              level4: {
                value: 'different',
              },
            },
          },
        },
      };

      expect(areJsonValuesEqual(deep1, deep3)).toBe(false);
    });
  });

  describe('Performance with large structures', () => {
    it('should handle large arrays efficiently', () => {
      const largeArray1 = Array.from({ length: 1000 }, (_, i) => i);
      const largeArray2 = Array.from({ length: 1000 }, (_, i) => i);
      const largeArray3 = Array.from({ length: 1000 }, (_, i) => (i === 999 ? 9999 : i));

      expect(areJsonValuesEqual(largeArray1, largeArray2)).toBe(true);
      expect(areJsonValuesEqual(largeArray1, largeArray3)).toBe(false);
    });

    it('should handle objects with many keys', () => {
      const largeObj1: { [key: string]: number } = {};
      const largeObj2: { [key: string]: number } = {};

      for (let i = 0; i < 100; i++) {
        largeObj1[`key${i}`] = i;
        largeObj2[`key${i}`] = i;
      }

      expect(areJsonValuesEqual(largeObj1, largeObj2)).toBe(true);

      largeObj2['key99'] = 9999;
      expect(areJsonValuesEqual(largeObj1, largeObj2)).toBe(false);
    });
  });

  describe('Edge cases', () => {
    it('should handle empty string vs null', () => {
      expect(areJsonValuesEqual('', null)).toBe(false);
      expect(areJsonValuesEqual('', '')).toBe(true);
    });

    it('should handle zero vs null', () => {
      expect(areJsonValuesEqual(0, null)).toBe(false);
      expect(areJsonValuesEqual(0, 0)).toBe(true);
    });

    it('should handle empty array vs empty object', () => {
      expect(areJsonValuesEqual([], {})).toBe(false);
    });

    it('should handle arrays with null elements', () => {
      expect(areJsonValuesEqual([null, null], [null, null])).toBe(true);
      // Note: undefined in arrays gets normalized to null during comparison
      const arrayWithUndefined: (Json | undefined)[] = [undefined];
      expect(areJsonValuesEqual([null], arrayWithUndefined as Json)).toBe(false);
    });
  });
});
