import { describe, expect, it } from 'vitest';
import {
  UuidMappings,
  deserializeUuidMappings,
  normalizeUuidForLookup,
  serializeUuidMappings,
} from '../load-uuid-mapping';

describe('UUID Mapping Utilities', () => {
  describe('normalizeUuidForLookup', () => {
    it('should convert uppercase UUID to lowercase', () => {
      const uppercase = '550E8400-E29B-41D4-A716-446655440000';
      expect(normalizeUuidForLookup(uppercase)).toBe('550e8400-e29b-41d4-a716-446655440000');
    });

    it('should preserve already lowercase UUID', () => {
      const lowercase = '550e8400-e29b-41d4-a716-446655440000';
      expect(normalizeUuidForLookup(lowercase)).toBe('550e8400-e29b-41d4-a716-446655440000');
    });

    it('should handle mixed case UUID', () => {
      const mixedCase = '550E8400-e29B-41D4-a716-446655440000';
      expect(normalizeUuidForLookup(mixedCase)).toBe('550e8400-e29b-41d4-a716-446655440000');
    });

    it('should convert non-hyphenated UUID to hyphenated lowercase', () => {
      const noHyphens = '550E8400E29B41D4A716446655440000';
      expect(normalizeUuidForLookup(noHyphens)).toBe('550e8400-e29b-41d4-a716-446655440000');
    });

    it('should handle non-hyphenated lowercase UUID', () => {
      const noHyphensLower = 'd31df3fee2d2448088b050b2e9f23ed9';
      expect(normalizeUuidForLookup(noHyphensLower)).toBe('d31df3fe-e2d2-4480-88b0-50b2e9f23ed9');
    });
  });

  describe('serializeUuidMappings', () => {
    it('should convert Maps to plain objects', () => {
      const mappings: UuidMappings = {
        notionPageIDsToAtlasUUIDs: new Map([
          ['11111111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-222222222222'],
          ['33333333-3333-3333-3333-333333333333', '44444444-4444-4444-4444-444444444444'],
        ]),
        atlasUUIDsToNotionPageIds: new Map([
          ['22222222-2222-2222-2222-222222222222', '11111111-1111-1111-1111-111111111111'],
          ['44444444-4444-4444-4444-444444444444', '33333333-3333-3333-3333-333333333333'],
        ]),
      };

      const serialized = serializeUuidMappings(mappings);

      expect(serialized.notionPageIDsToAtlasUUIDs).toEqual({
        '11111111-1111-1111-1111-111111111111': '22222222-2222-2222-2222-222222222222',
        '33333333-3333-3333-3333-333333333333': '44444444-4444-4444-4444-444444444444',
      });
      expect(serialized.atlasUUIDsToNotionPageIds).toEqual({
        '22222222-2222-2222-2222-222222222222': '11111111-1111-1111-1111-111111111111',
        '44444444-4444-4444-4444-444444444444': '33333333-3333-3333-3333-333333333333',
      });
    });
  });

  describe('deserializeUuidMappings', () => {
    it('should convert plain objects to Maps with normalized UUIDs', () => {
      const serialized = {
        notionPageIDsToAtlasUUIDs: {
          // Uppercase keys should be normalized to lowercase
          'AAAAAAAA-BBBB-CCCC-DDDD-EEEEEEEEEEEE': 'FFFFFFFF-GGGG-0000-1111-222222222222',
          '33333333-4444-5555-6666-777777777777': '88888888-9999-aaaa-bbbb-cccccccccccc',
        },
        atlasUUIDsToNotionPageIds: {
          'FFFFFFFF-GGGG-0000-1111-222222222222': 'AAAAAAAA-BBBB-CCCC-DDDD-EEEEEEEEEEEE',
          '88888888-9999-aaaa-bbbb-cccccccccccc': '33333333-4444-5555-6666-777777777777',
        },
      };

      const mappings = deserializeUuidMappings(serialized);

      // Check that keys are normalized to lowercase (lookup with lowercase)
      expect(mappings.notionPageIDsToAtlasUUIDs.get('aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee')).toBe(
        'ffffffff-gggg-0000-1111-222222222222',
      );
      expect(mappings.notionPageIDsToAtlasUUIDs.get('33333333-4444-5555-6666-777777777777')).toBe(
        '88888888-9999-aaaa-bbbb-cccccccccccc',
      );

      expect(mappings.atlasUUIDsToNotionPageIds.get('ffffffff-gggg-0000-1111-222222222222')).toBe(
        'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee',
      );
      expect(mappings.atlasUUIDsToNotionPageIds.get('88888888-9999-aaaa-bbbb-cccccccccccc')).toBe(
        '33333333-4444-5555-6666-777777777777',
      );
    });

    it('should allow case-insensitive lookups after deserialization', () => {
      const serialized = {
        notionPageIDsToAtlasUUIDs: {
          '550e8400-e29b-41d4-a716-446655440000': 'abc12345-def6-7890-abcd-ef1234567890',
        },
        atlasUUIDsToNotionPageIds: {
          'abc12345-def6-7890-abcd-ef1234567890': '550e8400-e29b-41d4-a716-446655440000',
        },
      };

      const mappings = deserializeUuidMappings(serialized);

      // Lookup with uppercase should work because keys are normalized
      const atlasUuid = mappings.notionPageIDsToAtlasUUIDs.get(
        normalizeUuidForLookup('550E8400-E29B-41D4-A716-446655440000'),
      );
      expect(atlasUuid).toBe('abc12345-def6-7890-abcd-ef1234567890');
    });
  });

  describe('UUID mapping lookup consistency', () => {
    it('should allow lookups regardless of case when using normalizeUuidForLookup', () => {
      // Simulate what loadUuidMappings would produce (all lowercase hyphenated)
      const mappings: UuidMappings = {
        notionPageIDsToAtlasUUIDs: new Map([
          ['550e8400-e29b-41d4-a716-446655440000', 'abc12345-def6-7890-abcd-ef1234567890'],
        ]),
        atlasUUIDsToNotionPageIds: new Map([
          ['abc12345-def6-7890-abcd-ef1234567890', '550e8400-e29b-41d4-a716-446655440000'],
        ]),
      };

      // Lookup with various case formats should all work
      const uppercaseNotionId = '550E8400-E29B-41D4-A716-446655440000';
      const mixedCaseNotionId = '550e8400-E29B-41d4-A716-446655440000';
      const lowercaseNotionId = '550e8400-e29b-41d4-a716-446655440000';

      expect(mappings.notionPageIDsToAtlasUUIDs.get(normalizeUuidForLookup(uppercaseNotionId))).toBe(
        'abc12345-def6-7890-abcd-ef1234567890',
      );
      expect(mappings.notionPageIDsToAtlasUUIDs.get(normalizeUuidForLookup(mixedCaseNotionId))).toBe(
        'abc12345-def6-7890-abcd-ef1234567890',
      );
      expect(mappings.notionPageIDsToAtlasUUIDs.get(normalizeUuidForLookup(lowercaseNotionId))).toBe(
        'abc12345-def6-7890-abcd-ef1234567890',
      );
    });

    it('should allow lookups with non-hyphenated UUID input', () => {
      // Simulate what loadUuidMappings would produce (all lowercase hyphenated)
      const mappings: UuidMappings = {
        notionPageIDsToAtlasUUIDs: new Map([
          ['d31df3fe-e2d2-4480-88b0-50b2e9f23ed9', '305e2bd6-a594-4aec-8713-adbe7bc87120'],
        ]),
        atlasUUIDsToNotionPageIds: new Map([
          ['305e2bd6-a594-4aec-8713-adbe7bc87120', 'd31df3fe-e2d2-4480-88b0-50b2e9f23ed9'],
        ]),
      };

      // Lookup with non-hyphenated UUID (as extracted from Notion URLs) should work
      const nonHyphenated = 'd31df3fee2d2448088b050b2e9f23ed9';
      expect(mappings.notionPageIDsToAtlasUUIDs.get(normalizeUuidForLookup(nonHyphenated))).toBe(
        '305e2bd6-a594-4aec-8713-adbe7bc87120',
      );
    });
  });
});
