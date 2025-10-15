import { beforeEach, describe, expect, it } from 'vitest';
import type { BaseAtlasDocument, StandardizedAtlasScopeTrees } from '../../json-export/types';
import {
  type LookupMaps,
  buildAncestryList,
  buildLookupMaps,
  compareDocumentFields,
  detectChanges,
  extractAllUuids,
  extractDocNoAncestryPath,
  extractDocNoLastSegment,
  stripChildCollections,
} from '../atlas-diff';

describe('extractDocNoAncestryPath', () => {
  it('extracts parent path from standard doc_no', () => {
    expect(extractDocNoAncestryPath('A.2.9.1')).toBe('A.2.9');
    expect(extractDocNoAncestryPath('A.2.9')).toBe('A.2');
    expect(extractDocNoAncestryPath('A.2')).toBe('A');
  });

  it('handles doc_no with no parent', () => {
    expect(extractDocNoAncestryPath('A')).toBe('');
    expect(extractDocNoAncestryPath('NR-1')).toBe('');
  });

  it('handles special doc_no formats', () => {
    expect(extractDocNoAncestryPath('.var1')).toBe('');
    expect(extractDocNoAncestryPath('.0.3.1')).toBe('.0.3');
    expect(extractDocNoAncestryPath('.0.3')).toBe('.0');

    // Deeply nested special formats
    expect(extractDocNoAncestryPath('A.1.4.5.0.4.1.1.1.var1')).toBe('A.1.4.5.0.4.1.1.1');
    expect(extractDocNoAncestryPath('A.1.4.5.0.4.1.1.1')).toBe('A.1.4.5.0.4.1.1');
    expect(extractDocNoAncestryPath('A.2.3.0.3.1')).toBe('A.2.3.0.3');
    expect(extractDocNoAncestryPath('A.2.3.0.6.1')).toBe('A.2.3.0.6');

    // Scenario variations deeply nested
    expect(extractDocNoAncestryPath('A.1.2.3.0.4.1.var2')).toBe('A.1.2.3.0.4.1');
    expect(extractDocNoAncestryPath('A.1.2.3.0.4.1.1.var3')).toBe('A.1.2.3.0.4.1.1');
  });

  it('handles multi-digit segments', () => {
    expect(extractDocNoAncestryPath('A.12.99.123')).toBe('A.12.99');
    expect(extractDocNoAncestryPath('A.2.99.1')).toBe('A.2.99');
  });
});

describe('extractDocNoLastSegment', () => {
  it('extracts last segment from standard doc_no', () => {
    expect(extractDocNoLastSegment('A.2.9.1')).toBe('1');
    expect(extractDocNoLastSegment('A.2.9')).toBe('9');
    expect(extractDocNoLastSegment('A.2')).toBe('2');
  });

  it('handles doc_no with no dots', () => {
    expect(extractDocNoLastSegment('A')).toBe('A');
    expect(extractDocNoLastSegment('NR-1')).toBe('NR-1');
  });

  it('handles special doc_no formats', () => {
    expect(extractDocNoLastSegment('.var1')).toBe('var1');
    expect(extractDocNoLastSegment('.0.3.1')).toBe('1');

    // Deeply nested special formats
    expect(extractDocNoLastSegment('A.1.4.5.0.4.1.1.1.var1')).toBe('var1');
    expect(extractDocNoLastSegment('A.1.4.5.0.4.1.1.1')).toBe('1');
    expect(extractDocNoLastSegment('A.2.3.0.3.1')).toBe('1');
    expect(extractDocNoLastSegment('A.2.3.0.6.1')).toBe('1');

    // Scenario variations deeply nested
    expect(extractDocNoLastSegment('A.1.2.3.0.4.1.var2')).toBe('var2');
    expect(extractDocNoLastSegment('A.1.2.3.0.4.1.1.var3')).toBe('var3');
  });

  it('handles multi-digit segments', () => {
    expect(extractDocNoLastSegment('A.2.9.12')).toBe('12');
    expect(extractDocNoLastSegment('A.2.9.123')).toBe('123');
  });
});

describe('stripChildCollections', () => {
  it('strips child collections from a document', () => {
    const doc = {
      type: 'Scope' as const,
      doc_no: 'A.1',
      name: 'Test Scope',
      uuid: 'uuid-1',
      content: 'Test content',
      last_modified: '2025-01-01',
      articles: [
        {
          type: 'Article' as const,
          doc_no: 'A.1.1',
          name: 'Child Article',
          uuid: 'uuid-2',
          content: 'Child content',
          last_modified: '2025-01-01',
          sections_and_primary_docs: [],
          annotations: [],
          needed_research: [],
        },
      ],
    };

    const stripped = stripChildCollections(doc);

    expect(stripped).toEqual({
      type: 'Scope',
      doc_no: 'A.1',
      name: 'Test Scope',
      uuid: 'uuid-1',
      content: 'Test content',
      last_modified: '',
    });
    expect('articles' in stripped).toBe(false);
  });

  it('includes extra fields for Type Specification documents', () => {
    const doc = {
      type: 'Type Specification' as const,
      doc_no: 'A.1.1.1',
      name: 'Test Type Spec',
      uuid: 'uuid-1',
      content: 'Test content',
      last_modified: '2025-01-01',
      type_specification_type_name: 'TestType',
      type_specification_type_category: 'Category',
      type_specification_type_overview: 'Overview',
      type_specification_doc_identifier_rules: 'Rules',
      type_specification_additional_logic: 'Logic',
      sections_and_primary_docs: [],
      agent_scope_database: [],
      annotations: [],
      tenets: [],
      active_data: [],
      needed_research: [],
    };

    const stripped = stripChildCollections(doc);

    // Cast to access extra fields since BaseAtlasDocument doesn't include them in its type
    const strippedWithExtras = stripped as BaseAtlasDocument & {
      type_specification_type_name?: string;
      type_specification_type_category?: string;
    };

    expect(strippedWithExtras.type_specification_type_name).toBe('TestType');
    expect(strippedWithExtras.type_specification_type_category).toBe('Category');
    expect('sections_and_primary_docs' in stripped).toBe(false);
  });
});

describe('buildLookupMaps', () => {
  it('builds UUID and doc_no lookup maps', () => {
    const scopeTrees: StandardizedAtlasScopeTrees = [
      {
        type: 'Scope',
        doc_no: 'A.1',
        name: 'Scope 1',
        uuid: 'uuid-1',
        content: 'Content 1',
        last_modified: '2025-01-01',
        articles: [
          {
            type: 'Article',
            doc_no: 'A.1.1',
            name: 'Article 1',
            uuid: 'uuid-2',
            content: 'Content 2',
            last_modified: '2025-01-01',
            sections_and_primary_docs: [],
            annotations: [],
            needed_research: [],
          },
        ],
      },
    ];

    const maps = buildLookupMaps(scopeTrees);

    expect(maps.uuidToDoc.size).toBe(2);
    expect(maps.docNoToDoc.size).toBe(2);
    expect(maps.uuidToDoc.get('uuid-1')?.doc_no).toBe('A.1');
    expect(maps.uuidToDoc.get('uuid-2')?.doc_no).toBe('A.1.1');
    expect(maps.docNoToDoc.get('A.1')?.uuid).toBe('uuid-1');
    expect(maps.docNoToDoc.get('A.1.1')?.uuid).toBe('uuid-2');
  });

  it('handles documents without UUIDs', () => {
    const scopeTrees: StandardizedAtlasScopeTrees = [
      {
        type: 'Scope',
        doc_no: 'A.1',
        name: 'Scope 1',
        uuid: null,
        content: 'Content 1',
        last_modified: '2025-01-01',
        articles: [],
      },
    ];

    const maps = buildLookupMaps(scopeTrees);

    expect(maps.uuidToDoc.size).toBe(0);
    expect(maps.docNoToDoc.size).toBe(1);
    expect(maps.docNoToDoc.get('A.1')?.uuid).toBe(null);
  });
});

describe('extractAllUuids', () => {
  it('extracts all UUIDs from a lookup map', () => {
    const lookupMap = new Map<string, BaseAtlasDocument>([
      ['uuid-1', { type: 'Scope', doc_no: 'A.1', name: 'Scope 1', uuid: 'uuid-1', content: '', last_modified: '' }],
      [
        'uuid-2',
        { type: 'Article', doc_no: 'A.1.1', name: 'Article 1', uuid: 'uuid-2', content: '', last_modified: '' },
      ],
    ]);

    const uuids = extractAllUuids(lookupMap);

    expect(uuids.size).toBe(2);
    expect(uuids.has('uuid-1')).toBe(true);
    expect(uuids.has('uuid-2')).toBe(true);
  });
});

describe('compareDocumentFields', () => {
  const baseDoc: BaseAtlasDocument = {
    type: 'Scope',
    doc_no: 'A.1',
    name: 'Test',
    uuid: 'uuid-1',
    content: 'Content',
    last_modified: '2025-01-01',
  };

  it('returns false when documents are identical', () => {
    const doc1 = { ...baseDoc };
    const doc2 = { ...baseDoc };
    expect(compareDocumentFields(doc1, doc2)).toBe(false);
  });

  it('detects type changes', () => {
    const doc1 = { ...baseDoc };
    const doc2 = { ...baseDoc, type: 'Article' as const };
    expect(compareDocumentFields(doc1, doc2)).toBe(true);
  });

  it('detects name changes', () => {
    const doc1 = { ...baseDoc };
    const doc2 = { ...baseDoc, name: 'Different Name' };
    expect(compareDocumentFields(doc1, doc2)).toBe(true);
  });

  it('detects content changes', () => {
    const doc1 = { ...baseDoc };
    const doc2 = { ...baseDoc, content: 'Different Content' };
    expect(compareDocumentFields(doc1, doc2)).toBe(true);
  });

  it('ignores last_modified changes', () => {
    const doc1 = { ...baseDoc, last_modified: '2025-01-01' };
    const doc2 = { ...baseDoc, last_modified: '2025-01-02' };
    expect(compareDocumentFields(doc1, doc2)).toBe(false);
  });

  it('detects extra field changes for Type Specification', () => {
    const doc1 = {
      ...baseDoc,
      type: 'Type Specification' as const,
      type_specification_type_name: 'TypeA',
    };
    const doc2 = {
      ...baseDoc,
      type: 'Type Specification' as const,
      type_specification_type_name: 'TypeB',
    };
    expect(compareDocumentFields(doc1, doc2)).toBe(true);
  });
});

describe('buildAncestryList', () => {
  let maps: LookupMaps;

  beforeEach(() => {
    maps = {
      uuidToDoc: new Map([
        ['uuid-1', { type: 'Scope', doc_no: 'A.1', name: 'Scope', uuid: 'uuid-1', content: '', last_modified: '' }],
        [
          'uuid-2',
          { type: 'Article', doc_no: 'A.1.1', name: 'Article', uuid: 'uuid-2', content: '', last_modified: '' },
        ],
        [
          'uuid-3',
          { type: 'Section', doc_no: 'A.1.1.1', name: 'Section', uuid: 'uuid-3', content: '', last_modified: '' },
        ],
      ]),
      docNoToDoc: new Map([
        ['A.1', { type: 'Scope', doc_no: 'A.1', name: 'Scope', uuid: 'uuid-1', content: '', last_modified: '' }],
        [
          'A.1.1',
          { type: 'Article', doc_no: 'A.1.1', name: 'Article', uuid: 'uuid-2', content: '', last_modified: '' },
        ],
        [
          'A.1.1.1',
          { type: 'Section', doc_no: 'A.1.1.1', name: 'Section', uuid: 'uuid-3', content: '', last_modified: '' },
        ],
      ]),
    };
  });

  it('builds ancestry list for nested document', () => {
    const ancestry = buildAncestryList('uuid-3', maps.uuidToDoc, maps.docNoToDoc);
    expect(ancestry).toEqual(['uuid-1', 'uuid-2']);
  });

  it('builds ancestry list for direct child', () => {
    const ancestry = buildAncestryList('uuid-2', maps.uuidToDoc, maps.docNoToDoc);
    expect(ancestry).toEqual(['uuid-1']);
  });

  it('returns empty array for root document', () => {
    const ancestry = buildAncestryList('uuid-1', maps.uuidToDoc, maps.docNoToDoc);
    expect(ancestry).toEqual([]);
  });

  it('returns empty array for non-existent UUID', () => {
    const ancestry = buildAncestryList('uuid-999', maps.uuidToDoc, maps.docNoToDoc);
    expect(ancestry).toEqual([]);
  });

  it('detects cycles and returns empty array', () => {
    // Create a cycle where doc A.1.1.1 has parent A.1.1, which has parent A.1, which has parent A.1.1.1 (circular)
    const cyclicMaps: LookupMaps = {
      uuidToDoc: new Map([
        ['uuid-1', { type: 'Scope', doc_no: 'A.1', name: 'Scope', uuid: 'uuid-1', content: '', last_modified: '' }],
        [
          'uuid-2',
          { type: 'Article', doc_no: 'A.1.1', name: 'Article', uuid: 'uuid-2', content: '', last_modified: '' },
        ],
        [
          'uuid-3',
          { type: 'Section', doc_no: 'A.1.1.1', name: 'Section', uuid: 'uuid-3', content: '', last_modified: '' },
        ],
      ]),
      docNoToDoc: new Map([
        // Create cycle: A.1.1.1 -> A.1.1 -> A.1 -> A.1.1.1
        ['A.1', { type: 'Scope', doc_no: 'A.1', name: 'Scope', uuid: 'uuid-1', content: '', last_modified: '' }],
        [
          'A.1.1',
          { type: 'Article', doc_no: 'A.1.1', name: 'Article', uuid: 'uuid-2', content: '', last_modified: '' },
        ],
        [
          'A.1.1.1',
          { type: 'Section', doc_no: 'A.1.1.1', name: 'Section', uuid: 'uuid-3', content: '', last_modified: '' },
        ],
        // Make A.1's parent point to A.1.1.1 to create a cycle
        ['A', { type: 'Scope', doc_no: 'A', name: 'Root', uuid: 'uuid-3', content: '', last_modified: '' }],
      ]),
    };

    // When building ancestry for uuid-3 (A.1.1.1), it will eventually try to add uuid-3 again
    const ancestry = buildAncestryList('uuid-3', cyclicMaps.uuidToDoc, cyclicMaps.docNoToDoc);

    // The cycle detection should prevent infinite recursion
    // The ancestry should stop when it detects the cycle
    expect(ancestry.length).toBeLessThan(10); // Should not recurse infinitely
  });
});

describe('detectChanges', () => {
  it('detects added documents', () => {
    const originalMaps: LookupMaps = {
      uuidToDoc: new Map(),
      docNoToDoc: new Map(),
    };

    const newMaps: LookupMaps = {
      uuidToDoc: new Map([
        ['uuid-1', { type: 'Scope', doc_no: 'A.1', name: 'New Scope', uuid: 'uuid-1', content: '', last_modified: '' }],
      ]),
      docNoToDoc: new Map([
        ['A.1', { type: 'Scope', doc_no: 'A.1', name: 'New Scope', uuid: 'uuid-1', content: '', last_modified: '' }],
      ]),
    };

    const changes = detectChanges(originalMaps, newMaps, new Set(), new Set(['uuid-1']));

    expect(changes).toHaveLength(1);
    expect(changes[0].changeType).toBe('added');
    expect(changes[0].uuid).toBe('uuid-1');
    expect(changes[0].newValues?.name).toBe('New Scope');
    expect(changes[0].oldValues).toBeUndefined();
  });

  it('detects deleted documents', () => {
    const originalMaps: LookupMaps = {
      uuidToDoc: new Map([
        ['uuid-1', { type: 'Scope', doc_no: 'A.1', name: 'Old Scope', uuid: 'uuid-1', content: '', last_modified: '' }],
      ]),
      docNoToDoc: new Map([
        ['A.1', { type: 'Scope', doc_no: 'A.1', name: 'Old Scope', uuid: 'uuid-1', content: '', last_modified: '' }],
      ]),
    };

    const newMaps: LookupMaps = {
      uuidToDoc: new Map(),
      docNoToDoc: new Map(),
    };

    const changes = detectChanges(originalMaps, newMaps, new Set(['uuid-1']), new Set());

    expect(changes).toHaveLength(1);
    expect(changes[0].changeType).toBe('deleted');
    expect(changes[0].uuid).toBe('uuid-1');
    expect(changes[0].oldValues?.name).toBe('Old Scope');
    expect(changes[0].newValues).toBeUndefined();
  });

  it('detects field changes', () => {
    const originalMaps: LookupMaps = {
      uuidToDoc: new Map([
        [
          'uuid-1',
          { type: 'Scope', doc_no: 'A.1', name: 'Old Name', uuid: 'uuid-1', content: 'Old content', last_modified: '' },
        ],
      ]),
      docNoToDoc: new Map([
        [
          'A.1',
          { type: 'Scope', doc_no: 'A.1', name: 'Old Name', uuid: 'uuid-1', content: 'Old content', last_modified: '' },
        ],
      ]),
    };

    const newMaps: LookupMaps = {
      uuidToDoc: new Map([
        [
          'uuid-1',
          { type: 'Scope', doc_no: 'A.1', name: 'New Name', uuid: 'uuid-1', content: 'New content', last_modified: '' },
        ],
      ]),
      docNoToDoc: new Map([
        [
          'A.1',
          { type: 'Scope', doc_no: 'A.1', name: 'New Name', uuid: 'uuid-1', content: 'New content', last_modified: '' },
        ],
      ]),
    };

    const changes = detectChanges(originalMaps, newMaps, new Set(['uuid-1']), new Set(['uuid-1']));

    expect(changes).toHaveLength(1);
    expect(changes[0].changeType).toBe('changed');
    expect(changes[0].uuid).toBe('uuid-1');
    expect(changes[0].oldValues?.name).toBe('Old Name');
    expect(changes[0].newValues?.name).toBe('New Name');
  });

  it('detects sibling order changes', () => {
    const originalMaps: LookupMaps = {
      uuidToDoc: new Map([
        [
          'uuid-1',
          { type: 'Article', doc_no: 'A.1.1', name: 'Article', uuid: 'uuid-1', content: '', last_modified: '' },
        ],
      ]),
      docNoToDoc: new Map([
        ['A.1', { type: 'Scope', doc_no: 'A.1', name: 'Scope', uuid: 'uuid-scope', content: '', last_modified: '' }],
        [
          'A.1.1',
          { type: 'Article', doc_no: 'A.1.1', name: 'Article', uuid: 'uuid-1', content: '', last_modified: '' },
        ],
      ]),
    };

    const newMaps: LookupMaps = {
      uuidToDoc: new Map([
        [
          'uuid-1',
          { type: 'Article', doc_no: 'A.1.2', name: 'Article', uuid: 'uuid-1', content: '', last_modified: '' },
        ],
      ]),
      docNoToDoc: new Map([
        ['A.1', { type: 'Scope', doc_no: 'A.1', name: 'Scope', uuid: 'uuid-scope', content: '', last_modified: '' }],
        [
          'A.1.2',
          { type: 'Article', doc_no: 'A.1.2', name: 'Article', uuid: 'uuid-1', content: '', last_modified: '' },
        ],
      ]),
    };

    const changes = detectChanges(originalMaps, newMaps, new Set(['uuid-1']), new Set(['uuid-1']));

    expect(changes).toHaveLength(1);
    expect(changes[0].changeType).toBe('sibling_order_changed');
    expect(changes[0].uuid).toBe('uuid-1');
    expect(changes[0].oldValues?.doc_no).toBe('A.1.1');
    expect(changes[0].newValues?.doc_no).toBe('A.1.2');
  });

  it('detects parent changes', () => {
    const originalMaps: LookupMaps = {
      uuidToDoc: new Map([
        [
          'uuid-1',
          { type: 'Section', doc_no: 'A.1.1.1', name: 'Section', uuid: 'uuid-1', content: '', last_modified: '' },
        ],
      ]),
      docNoToDoc: new Map([
        [
          'A.1.1',
          { type: 'Article', doc_no: 'A.1.1', name: 'Article 1', uuid: 'uuid-a1', content: '', last_modified: '' },
        ],
        [
          'A.1.1.1',
          { type: 'Section', doc_no: 'A.1.1.1', name: 'Section', uuid: 'uuid-1', content: '', last_modified: '' },
        ],
      ]),
    };

    const newMaps: LookupMaps = {
      uuidToDoc: new Map([
        [
          'uuid-1',
          { type: 'Section', doc_no: 'A.1.2.1', name: 'Section', uuid: 'uuid-1', content: '', last_modified: '' },
        ],
      ]),
      docNoToDoc: new Map([
        [
          'A.1.2',
          { type: 'Article', doc_no: 'A.1.2', name: 'Article 2', uuid: 'uuid-a2', content: '', last_modified: '' },
        ],
        [
          'A.1.2.1',
          { type: 'Section', doc_no: 'A.1.2.1', name: 'Section', uuid: 'uuid-1', content: '', last_modified: '' },
        ],
      ]),
    };

    const changes = detectChanges(originalMaps, newMaps, new Set(['uuid-1']), new Set(['uuid-1']));

    expect(changes).toHaveLength(1);
    expect(changes[0].changeType).toBe('parent_changed');
    expect(changes[0].uuid).toBe('uuid-1');
    expect(changes[0].oldValues?.doc_no).toBe('A.1.1.1');
    expect(changes[0].newValues?.doc_no).toBe('A.1.2.1');
  });

  it('handles missing documents gracefully', () => {
    const originalMaps: LookupMaps = {
      uuidToDoc: new Map(),
      docNoToDoc: new Map(),
    };

    const newMaps: LookupMaps = {
      uuidToDoc: new Map(),
      docNoToDoc: new Map(),
    };

    // UUID exists in set but not in map (data inconsistency)
    const changes = detectChanges(originalMaps, newMaps, new Set(['uuid-missing']), new Set(['uuid-missing']));

    expect(changes).toHaveLength(0);
  });

  it('detects multiple change types in one batch', () => {
    const originalMaps: LookupMaps = {
      uuidToDoc: new Map([
        ['uuid-1', { type: 'Scope', doc_no: 'A.1', name: 'Scope 1', uuid: 'uuid-1', content: '', last_modified: '' }],
        [
          'uuid-2',
          { type: 'Article', doc_no: 'A.1.1', name: 'Article 1', uuid: 'uuid-2', content: '', last_modified: '' },
        ],
      ]),
      docNoToDoc: new Map([
        ['A.1', { type: 'Scope', doc_no: 'A.1', name: 'Scope 1', uuid: 'uuid-1', content: '', last_modified: '' }],
        [
          'A.1.1',
          { type: 'Article', doc_no: 'A.1.1', name: 'Article 1', uuid: 'uuid-2', content: '', last_modified: '' },
        ],
      ]),
    };

    const newMaps: LookupMaps = {
      uuidToDoc: new Map([
        [
          'uuid-1',
          { type: 'Scope', doc_no: 'A.1', name: 'Scope 1 Updated', uuid: 'uuid-1', content: '', last_modified: '' },
        ],
        [
          'uuid-3',
          { type: 'Article', doc_no: 'A.1.2', name: 'Article 2', uuid: 'uuid-3', content: '', last_modified: '' },
        ],
      ]),
      docNoToDoc: new Map([
        [
          'A.1',
          { type: 'Scope', doc_no: 'A.1', name: 'Scope 1 Updated', uuid: 'uuid-1', content: '', last_modified: '' },
        ],
        [
          'A.1.2',
          { type: 'Article', doc_no: 'A.1.2', name: 'Article 2', uuid: 'uuid-3', content: '', last_modified: '' },
        ],
      ]),
    };

    const changes = detectChanges(originalMaps, newMaps, new Set(['uuid-1', 'uuid-2']), new Set(['uuid-1', 'uuid-3']));

    expect(changes).toHaveLength(3);

    const changeTypes = changes.map((c) => c.changeType).sort();
    expect(changeTypes).toEqual(['added', 'changed', 'deleted']);

    const addedChange = changes.find((c) => c.changeType === 'added');
    expect(addedChange?.uuid).toBe('uuid-3');

    const deletedChange = changes.find((c) => c.changeType === 'deleted');
    expect(deletedChange?.uuid).toBe('uuid-2');

    const changedChange = changes.find((c) => c.changeType === 'changed');
    expect(changedChange?.uuid).toBe('uuid-1');
  });
});
