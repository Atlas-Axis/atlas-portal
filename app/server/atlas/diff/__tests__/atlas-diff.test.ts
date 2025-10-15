import { describe, expect, it } from 'vitest';
import type { BaseAtlasDocument, StandardizedAtlasScopeTrees } from '../../json-export/types';
import {
  type LookupMaps,
  buildLookupMaps,
  compareDocumentFields,
  detectChanges,
  extractAllUuids,
  stripChildCollections,
} from '../atlas-diff';

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
  it('builds UUID, doc_no, and ancestry lookup maps', () => {
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
    expect(maps.uuidToAncestry.size).toBe(2);

    expect(maps.uuidToDoc.get('uuid-1')?.doc_no).toBe('A.1');
    expect(maps.uuidToDoc.get('uuid-2')?.doc_no).toBe('A.1.1');
    expect(maps.docNoToDoc.get('A.1')?.uuid).toBe('uuid-1');
    expect(maps.docNoToDoc.get('A.1.1')?.uuid).toBe('uuid-2');

    // Root document has empty ancestry
    expect(maps.uuidToAncestry.get('uuid-1')).toEqual([]);
    // Child document has parent in ancestry
    expect(maps.uuidToAncestry.get('uuid-2')).toEqual(['uuid-1']);
  });

  it('correctly tracks ancestry for nested documents', () => {
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
            sections_and_primary_docs: [
              {
                type: 'Section',
                doc_no: 'A.1.1.1',
                name: 'Section 1',
                uuid: 'uuid-3',
                content: 'Content 3',
                last_modified: '2025-01-01',
                sections_and_primary_docs: [],
                agent_scope_database: [],
                annotations: [],
                tenets: [],
                active_data: [],
                needed_research: [],
              },
            ],
            annotations: [],
            needed_research: [],
          },
        ],
      },
    ];

    const maps = buildLookupMaps(scopeTrees);

    expect(maps.uuidToAncestry.get('uuid-1')).toEqual([]);
    expect(maps.uuidToAncestry.get('uuid-2')).toEqual(['uuid-1']);
    expect(maps.uuidToAncestry.get('uuid-3')).toEqual(['uuid-1', 'uuid-2']);
  });

  it('correctly tracks ancestry for Needed Research documents', () => {
    const scopeTrees: StandardizedAtlasScopeTrees = [
      {
        type: 'Scope',
        doc_no: 'A.1',
        name: 'Scope 1',
        uuid: 'uuid-scope',
        content: 'Content 1',
        last_modified: '2025-01-01',
        articles: [
          {
            type: 'Article',
            doc_no: 'A.1.1',
            name: 'Article 1',
            uuid: 'uuid-article',
            content: 'Content 2',
            last_modified: '2025-01-01',
            sections_and_primary_docs: [],
            annotations: [],
            needed_research: [
              {
                type: 'Needed Research',
                doc_no: 'NR-1',
                name: 'Research Item 1',
                uuid: 'uuid-nr1',
                content: 'Research content',
                last_modified: '2025-01-01',
              },
            ],
          },
        ],
      },
    ];

    const maps = buildLookupMaps(scopeTrees);

    // Needed Research document should have correct ancestry despite global doc_no
    expect(maps.uuidToAncestry.get('uuid-nr1')).toEqual(['uuid-scope', 'uuid-article']);
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
    expect(maps.uuidToAncestry.size).toBe(0);
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

describe('detectChanges', () => {
  it('detects added documents', () => {
    const originalMaps: LookupMaps = {
      uuidToDoc: new Map(),
      docNoToDoc: new Map(),
      uuidToAncestry: new Map(),
    };

    const newMaps: LookupMaps = {
      uuidToDoc: new Map([
        ['uuid-1', { type: 'Scope', doc_no: 'A.1', name: 'New Scope', uuid: 'uuid-1', content: '', last_modified: '' }],
      ]),
      docNoToDoc: new Map([
        ['A.1', { type: 'Scope', doc_no: 'A.1', name: 'New Scope', uuid: 'uuid-1', content: '', last_modified: '' }],
      ]),
      uuidToAncestry: new Map([['uuid-1', []]]),
    };

    const changes = detectChanges(originalMaps, newMaps, new Set(), new Set(['uuid-1']));

    expect(changes.added).toHaveLength(1);
    expect(changes.deleted).toHaveLength(0);
    expect(changes.changed).toHaveLength(0);
    expect(changes.parent_changed).toHaveLength(0);
    expect(changes.sibling_order_changed).toHaveLength(0);

    expect(changes.added[0].changeType).toBe('added');
    expect(changes.added[0].uuid).toBe('uuid-1');
    expect(changes.added[0].newValues?.name).toBe('New Scope');
    expect(changes.added[0].oldValues).toBeUndefined();
  });

  it('detects deleted documents', () => {
    const originalMaps: LookupMaps = {
      uuidToDoc: new Map([
        ['uuid-1', { type: 'Scope', doc_no: 'A.1', name: 'Old Scope', uuid: 'uuid-1', content: '', last_modified: '' }],
      ]),
      docNoToDoc: new Map([
        ['A.1', { type: 'Scope', doc_no: 'A.1', name: 'Old Scope', uuid: 'uuid-1', content: '', last_modified: '' }],
      ]),
      uuidToAncestry: new Map([['uuid-1', []]]),
    };

    const newMaps: LookupMaps = {
      uuidToDoc: new Map(),
      docNoToDoc: new Map(),
      uuidToAncestry: new Map(),
    };

    const changes = detectChanges(originalMaps, newMaps, new Set(['uuid-1']), new Set());

    expect(changes.added).toHaveLength(0);
    expect(changes.deleted).toHaveLength(1);
    expect(changes.changed).toHaveLength(0);
    expect(changes.parent_changed).toHaveLength(0);
    expect(changes.sibling_order_changed).toHaveLength(0);

    expect(changes.deleted[0].changeType).toBe('deleted');
    expect(changes.deleted[0].uuid).toBe('uuid-1');
    expect(changes.deleted[0].oldValues?.name).toBe('Old Scope');
    expect(changes.deleted[0].newValues).toBeUndefined();
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
      uuidToAncestry: new Map([['uuid-1', []]]),
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
      uuidToAncestry: new Map([['uuid-1', []]]),
    };

    const changes = detectChanges(originalMaps, newMaps, new Set(['uuid-1']), new Set(['uuid-1']));

    expect(changes.added).toHaveLength(0);
    expect(changes.deleted).toHaveLength(0);
    expect(changes.changed).toHaveLength(1);
    expect(changes.parent_changed).toHaveLength(0);
    expect(changes.sibling_order_changed).toHaveLength(0);

    expect(changes.changed[0].changeType).toBe('changed');
    expect(changes.changed[0].uuid).toBe('uuid-1');
    expect(changes.changed[0].oldValues?.name).toBe('Old Name');
    expect(changes.changed[0].newValues?.name).toBe('New Name');
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
      uuidToAncestry: new Map([['uuid-1', ['uuid-scope']]]),
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
      uuidToAncestry: new Map([['uuid-1', ['uuid-scope']]]), // Same parent
    };

    const changes = detectChanges(originalMaps, newMaps, new Set(['uuid-1']), new Set(['uuid-1']));

    expect(changes.added).toHaveLength(0);
    expect(changes.deleted).toHaveLength(0);
    expect(changes.changed).toHaveLength(0);
    expect(changes.parent_changed).toHaveLength(0);
    expect(changes.sibling_order_changed).toHaveLength(1);

    expect(changes.sibling_order_changed[0].changeType).toBe('sibling_order_changed');
    expect(changes.sibling_order_changed[0].uuid).toBe('uuid-1');
    expect(changes.sibling_order_changed[0].oldValues?.doc_no).toBe('A.1.1');
    expect(changes.sibling_order_changed[0].newValues?.doc_no).toBe('A.1.2');
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
      uuidToAncestry: new Map([['uuid-1', ['uuid-scope', 'uuid-a1']]]),
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
      uuidToAncestry: new Map([['uuid-1', ['uuid-scope', 'uuid-a2']]]), // Different parent
    };

    const changes = detectChanges(originalMaps, newMaps, new Set(['uuid-1']), new Set(['uuid-1']));

    expect(changes.added).toHaveLength(0);
    expect(changes.deleted).toHaveLength(0);
    expect(changes.changed).toHaveLength(0);
    expect(changes.parent_changed).toHaveLength(1);
    expect(changes.sibling_order_changed).toHaveLength(0);

    expect(changes.parent_changed[0].changeType).toBe('parent_changed');
    expect(changes.parent_changed[0].uuid).toBe('uuid-1');
    expect(changes.parent_changed[0].oldValues?.doc_no).toBe('A.1.1.1');
    expect(changes.parent_changed[0].newValues?.doc_no).toBe('A.1.2.1');
  });

  it('detects parent changes for Needed Research documents', () => {
    // Needed Research document moved from Article A.1.1 to A.1.2
    const originalMaps: LookupMaps = {
      uuidToDoc: new Map([
        [
          'uuid-nr1',
          {
            type: 'Needed Research',
            doc_no: 'NR-1',
            name: 'Research Item',
            uuid: 'uuid-nr1',
            content: '',
            last_modified: '',
          },
        ],
      ]),
      docNoToDoc: new Map([
        [
          'NR-1',
          {
            type: 'Needed Research',
            doc_no: 'NR-1',
            name: 'Research Item',
            uuid: 'uuid-nr1',
            content: '',
            last_modified: '',
          },
        ],
      ]),
      uuidToAncestry: new Map([['uuid-nr1', ['uuid-scope', 'uuid-a1']]]),
    };

    const newMaps: LookupMaps = {
      uuidToDoc: new Map([
        [
          'uuid-nr1',
          {
            type: 'Needed Research',
            doc_no: 'NR-1',
            name: 'Research Item',
            uuid: 'uuid-nr1',
            content: '',
            last_modified: '',
          },
        ],
      ]),
      docNoToDoc: new Map([
        [
          'NR-1',
          {
            type: 'Needed Research',
            doc_no: 'NR-1',
            name: 'Research Item',
            uuid: 'uuid-nr1',
            content: '',
            last_modified: '',
          },
        ],
      ]),
      uuidToAncestry: new Map([['uuid-nr1', ['uuid-scope', 'uuid-a2']]]), // Different parent (moved from A.1.1 to A.1.2)
    };

    const changes = detectChanges(originalMaps, newMaps, new Set(['uuid-nr1']), new Set(['uuid-nr1']));

    expect(changes.added).toHaveLength(0);
    expect(changes.deleted).toHaveLength(0);
    expect(changes.changed).toHaveLength(0);
    expect(changes.parent_changed).toHaveLength(1);
    expect(changes.sibling_order_changed).toHaveLength(0);

    expect(changes.parent_changed[0].changeType).toBe('parent_changed');
    expect(changes.parent_changed[0].uuid).toBe('uuid-nr1');
    // doc_no stayed the same but parent changed
    expect(changes.parent_changed[0].oldValues?.doc_no).toBe('NR-1');
    expect(changes.parent_changed[0].newValues?.doc_no).toBe('NR-1');
    expect(changes.parent_changed[0].oldAncestry).toEqual(['uuid-scope', 'uuid-a1']);
    expect(changes.parent_changed[0].newAncestry).toEqual(['uuid-scope', 'uuid-a2']);
  });

  it('handles missing documents gracefully', () => {
    const originalMaps: LookupMaps = {
      uuidToDoc: new Map(),
      docNoToDoc: new Map(),
      uuidToAncestry: new Map(),
    };

    const newMaps: LookupMaps = {
      uuidToDoc: new Map(),
      docNoToDoc: new Map(),
      uuidToAncestry: new Map(),
    };

    // UUID exists in set but not in map (data inconsistency)
    const changes = detectChanges(originalMaps, newMaps, new Set(['uuid-missing']), new Set(['uuid-missing']));

    expect(changes.added).toHaveLength(0);
    expect(changes.deleted).toHaveLength(0);
    expect(changes.changed).toHaveLength(0);
    expect(changes.parent_changed).toHaveLength(0);
    expect(changes.sibling_order_changed).toHaveLength(0);
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
      uuidToAncestry: new Map([
        ['uuid-1', []],
        ['uuid-2', ['uuid-1']],
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
      uuidToAncestry: new Map([
        ['uuid-1', []],
        ['uuid-3', ['uuid-1']],
      ]),
    };

    const changes = detectChanges(originalMaps, newMaps, new Set(['uuid-1', 'uuid-2']), new Set(['uuid-1', 'uuid-3']));

    expect(changes.added).toHaveLength(1);
    expect(changes.deleted).toHaveLength(1);
    expect(changes.changed).toHaveLength(1);
    expect(changes.parent_changed).toHaveLength(0);
    expect(changes.sibling_order_changed).toHaveLength(0);

    expect(changes.added[0].uuid).toBe('uuid-3');
    expect(changes.added[0].changeType).toBe('added');

    expect(changes.deleted[0].uuid).toBe('uuid-2');
    expect(changes.deleted[0].changeType).toBe('deleted');

    expect(changes.changed[0].uuid).toBe('uuid-1');
    expect(changes.changed[0].changeType).toBe('changed');
  });

  it('detects multiple change types for the same document (field changes + parent changed)', () => {
    // Document has both content changes AND moved to different parent
    const originalMaps: LookupMaps = {
      uuidToDoc: new Map([
        [
          'uuid-1',
          {
            type: 'Section',
            doc_no: 'A.1.1.1',
            name: 'Old Name',
            uuid: 'uuid-1',
            content: 'Old content',
            last_modified: '',
          },
        ],
      ]),
      docNoToDoc: new Map([
        [
          'A.1.1.1',
          {
            type: 'Section',
            doc_no: 'A.1.1.1',
            name: 'Old Name',
            uuid: 'uuid-1',
            content: 'Old content',
            last_modified: '',
          },
        ],
      ]),
      uuidToAncestry: new Map([['uuid-1', ['uuid-scope', 'uuid-a1']]]),
    };

    const newMaps: LookupMaps = {
      uuidToDoc: new Map([
        [
          'uuid-1',
          {
            type: 'Section',
            doc_no: 'A.1.2.1',
            name: 'New Name',
            uuid: 'uuid-1',
            content: 'New content',
            last_modified: '',
          },
        ],
      ]),
      docNoToDoc: new Map([
        [
          'A.1.2.1',
          {
            type: 'Section',
            doc_no: 'A.1.2.1',
            name: 'New Name',
            uuid: 'uuid-1',
            content: 'New content',
            last_modified: '',
          },
        ],
      ]),
      uuidToAncestry: new Map([['uuid-1', ['uuid-scope', 'uuid-a2']]]), // Different parent
    };

    const changes = detectChanges(originalMaps, newMaps, new Set(['uuid-1']), new Set(['uuid-1']));

    // Should record TWO changes: one for field changes, one for parent change
    expect(changes.added).toHaveLength(0);
    expect(changes.deleted).toHaveLength(0);
    expect(changes.changed).toHaveLength(1);
    expect(changes.parent_changed).toHaveLength(1);
    expect(changes.sibling_order_changed).toHaveLength(0);

    // Verify the changed record
    expect(changes.changed[0].uuid).toBe('uuid-1');
    expect(changes.changed[0].changeType).toBe('changed');
    expect(changes.changed[0].oldValues?.name).toBe('Old Name');
    expect(changes.changed[0].newValues?.name).toBe('New Name');

    // Verify the parent_changed record
    expect(changes.parent_changed[0].uuid).toBe('uuid-1');
    expect(changes.parent_changed[0].changeType).toBe('parent_changed');
    expect(changes.parent_changed[0].oldAncestry).toEqual(['uuid-scope', 'uuid-a1']);
    expect(changes.parent_changed[0].newAncestry).toEqual(['uuid-scope', 'uuid-a2']);
  });

  it('detects multiple change types for the same document (field changes + sibling order changed)', () => {
    // Document has both content changes AND reordered among siblings
    const originalMaps: LookupMaps = {
      uuidToDoc: new Map([
        [
          'uuid-1',
          {
            type: 'Article',
            doc_no: 'A.1.1',
            name: 'Old Name',
            uuid: 'uuid-1',
            content: 'Old content',
            last_modified: '',
          },
        ],
      ]),
      docNoToDoc: new Map([
        [
          'A.1.1',
          {
            type: 'Article',
            doc_no: 'A.1.1',
            name: 'Old Name',
            uuid: 'uuid-1',
            content: 'Old content',
            last_modified: '',
          },
        ],
      ]),
      uuidToAncestry: new Map([['uuid-1', ['uuid-scope']]]),
    };

    const newMaps: LookupMaps = {
      uuidToDoc: new Map([
        [
          'uuid-1',
          {
            type: 'Article',
            doc_no: 'A.1.3',
            name: 'New Name',
            uuid: 'uuid-1',
            content: 'New content',
            last_modified: '',
          },
        ],
      ]),
      docNoToDoc: new Map([
        [
          'A.1.3',
          {
            type: 'Article',
            doc_no: 'A.1.3',
            name: 'New Name',
            uuid: 'uuid-1',
            content: 'New content',
            last_modified: '',
          },
        ],
      ]),
      uuidToAncestry: new Map([['uuid-1', ['uuid-scope']]]), // Same parent
    };

    const changes = detectChanges(originalMaps, newMaps, new Set(['uuid-1']), new Set(['uuid-1']));

    // Should record TWO changes: one for field changes, one for sibling order change
    expect(changes.added).toHaveLength(0);
    expect(changes.deleted).toHaveLength(0);
    expect(changes.changed).toHaveLength(1);
    expect(changes.parent_changed).toHaveLength(0);
    expect(changes.sibling_order_changed).toHaveLength(1);

    // Verify the changed record
    expect(changes.changed[0].uuid).toBe('uuid-1');
    expect(changes.changed[0].changeType).toBe('changed');
    expect(changes.changed[0].oldValues?.name).toBe('Old Name');
    expect(changes.changed[0].newValues?.name).toBe('New Name');

    // Verify the sibling_order_changed record
    expect(changes.sibling_order_changed[0].uuid).toBe('uuid-1');
    expect(changes.sibling_order_changed[0].changeType).toBe('sibling_order_changed');
    expect(changes.sibling_order_changed[0].oldValues?.doc_no).toBe('A.1.1');
    expect(changes.sibling_order_changed[0].newValues?.doc_no).toBe('A.1.3');
  });

  it('does not create duplicate changes when only parent changed (no field changes)', () => {
    // Document moved to different parent but content unchanged
    const originalMaps: LookupMaps = {
      uuidToDoc: new Map([
        [
          'uuid-1',
          {
            type: 'Section',
            doc_no: 'A.1.1.1',
            name: 'Same Name',
            uuid: 'uuid-1',
            content: 'Same content',
            last_modified: '',
          },
        ],
      ]),
      docNoToDoc: new Map([
        [
          'A.1.1.1',
          {
            type: 'Section',
            doc_no: 'A.1.1.1',
            name: 'Same Name',
            uuid: 'uuid-1',
            content: 'Same content',
            last_modified: '',
          },
        ],
      ]),
      uuidToAncestry: new Map([['uuid-1', ['uuid-scope', 'uuid-a1']]]),
    };

    const newMaps: LookupMaps = {
      uuidToDoc: new Map([
        [
          'uuid-1',
          {
            type: 'Section',
            doc_no: 'A.1.2.1',
            name: 'Same Name',
            uuid: 'uuid-1',
            content: 'Same content',
            last_modified: '',
          },
        ],
      ]),
      docNoToDoc: new Map([
        [
          'A.1.2.1',
          {
            type: 'Section',
            doc_no: 'A.1.2.1',
            name: 'Same Name',
            uuid: 'uuid-1',
            content: 'Same content',
            last_modified: '',
          },
        ],
      ]),
      uuidToAncestry: new Map([['uuid-1', ['uuid-scope', 'uuid-a2']]]),
    };

    const changes = detectChanges(originalMaps, newMaps, new Set(['uuid-1']), new Set(['uuid-1']));

    // Should only record parent_changed (no field changes)
    expect(changes.added).toHaveLength(0);
    expect(changes.deleted).toHaveLength(0);
    expect(changes.changed).toHaveLength(0);
    expect(changes.parent_changed).toHaveLength(1);
    expect(changes.sibling_order_changed).toHaveLength(0);

    expect(changes.parent_changed[0].uuid).toBe('uuid-1');
  });

  it('does not create duplicate changes when only sibling order changed (no field changes)', () => {
    // Document reordered but content unchanged
    const originalMaps: LookupMaps = {
      uuidToDoc: new Map([
        [
          'uuid-1',
          {
            type: 'Article',
            doc_no: 'A.1.1',
            name: 'Same Name',
            uuid: 'uuid-1',
            content: 'Same content',
            last_modified: '',
          },
        ],
      ]),
      docNoToDoc: new Map([
        [
          'A.1.1',
          {
            type: 'Article',
            doc_no: 'A.1.1',
            name: 'Same Name',
            uuid: 'uuid-1',
            content: 'Same content',
            last_modified: '',
          },
        ],
      ]),
      uuidToAncestry: new Map([['uuid-1', ['uuid-scope']]]),
    };

    const newMaps: LookupMaps = {
      uuidToDoc: new Map([
        [
          'uuid-1',
          {
            type: 'Article',
            doc_no: 'A.1.3',
            name: 'Same Name',
            uuid: 'uuid-1',
            content: 'Same content',
            last_modified: '',
          },
        ],
      ]),
      docNoToDoc: new Map([
        [
          'A.1.3',
          {
            type: 'Article',
            doc_no: 'A.1.3',
            name: 'Same Name',
            uuid: 'uuid-1',
            content: 'Same content',
            last_modified: '',
          },
        ],
      ]),
      uuidToAncestry: new Map([['uuid-1', ['uuid-scope']]]),
    };

    const changes = detectChanges(originalMaps, newMaps, new Set(['uuid-1']), new Set(['uuid-1']));

    // Should only record sibling_order_changed (no field changes)
    expect(changes.added).toHaveLength(0);
    expect(changes.deleted).toHaveLength(0);
    expect(changes.changed).toHaveLength(0);
    expect(changes.parent_changed).toHaveLength(0);
    expect(changes.sibling_order_changed).toHaveLength(1);

    expect(changes.sibling_order_changed[0].uuid).toBe('uuid-1');
  });

  it('ensures parent_changed and sibling_order_changed are mutually exclusive', () => {
    // When ancestry changes, only parent_changed should be recorded (not sibling_order_changed)
    const originalMaps: LookupMaps = {
      uuidToDoc: new Map([
        [
          'uuid-1',
          { type: 'Section', doc_no: 'A.1.1.1', name: 'Section', uuid: 'uuid-1', content: '', last_modified: '' },
        ],
      ]),
      docNoToDoc: new Map([
        [
          'A.1.1.1',
          { type: 'Section', doc_no: 'A.1.1.1', name: 'Section', uuid: 'uuid-1', content: '', last_modified: '' },
        ],
      ]),
      uuidToAncestry: new Map([['uuid-1', ['uuid-scope', 'uuid-a1']]]),
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
          'A.1.2.1',
          { type: 'Section', doc_no: 'A.1.2.1', name: 'Section', uuid: 'uuid-1', content: '', last_modified: '' },
        ],
      ]),
      uuidToAncestry: new Map([['uuid-1', ['uuid-scope', 'uuid-a2']]]), // Different parent
    };

    const changes = detectChanges(originalMaps, newMaps, new Set(['uuid-1']), new Set(['uuid-1']));

    // Only parent_changed should be recorded (even though doc_no also changed)
    expect(changes.added).toHaveLength(0);
    expect(changes.deleted).toHaveLength(0);
    expect(changes.changed).toHaveLength(0);
    expect(changes.parent_changed).toHaveLength(1);
    expect(changes.sibling_order_changed).toHaveLength(0); // NOT recorded

    expect(changes.parent_changed[0].uuid).toBe('uuid-1');
    expect(changes.parent_changed[0].oldValues?.doc_no).toBe('A.1.1.1');
    expect(changes.parent_changed[0].newValues?.doc_no).toBe('A.1.2.1');
  });

  it('ensures sibling_order_changed only triggers when ancestry is unchanged', () => {
    // When only doc_no changes (ancestry same), only sibling_order_changed should be recorded
    const originalMaps: LookupMaps = {
      uuidToDoc: new Map([
        [
          'uuid-1',
          { type: 'Article', doc_no: 'A.1.1', name: 'Article', uuid: 'uuid-1', content: '', last_modified: '' },
        ],
      ]),
      docNoToDoc: new Map([
        [
          'A.1.1',
          { type: 'Article', doc_no: 'A.1.1', name: 'Article', uuid: 'uuid-1', content: '', last_modified: '' },
        ],
      ]),
      uuidToAncestry: new Map([['uuid-1', ['uuid-scope']]]),
    };

    const newMaps: LookupMaps = {
      uuidToDoc: new Map([
        [
          'uuid-1',
          { type: 'Article', doc_no: 'A.1.3', name: 'Article', uuid: 'uuid-1', content: '', last_modified: '' },
        ],
      ]),
      docNoToDoc: new Map([
        [
          'A.1.3',
          { type: 'Article', doc_no: 'A.1.3', name: 'Article', uuid: 'uuid-1', content: '', last_modified: '' },
        ],
      ]),
      uuidToAncestry: new Map([['uuid-1', ['uuid-scope']]]), // Same parent
    };

    const changes = detectChanges(originalMaps, newMaps, new Set(['uuid-1']), new Set(['uuid-1']));

    // Only sibling_order_changed should be recorded (not parent_changed)
    expect(changes.added).toHaveLength(0);
    expect(changes.deleted).toHaveLength(0);
    expect(changes.changed).toHaveLength(0);
    expect(changes.parent_changed).toHaveLength(0); // NOT recorded
    expect(changes.sibling_order_changed).toHaveLength(1);

    expect(changes.sibling_order_changed[0].uuid).toBe('uuid-1');
    expect(changes.sibling_order_changed[0].oldValues?.doc_no).toBe('A.1.1');
    expect(changes.sibling_order_changed[0].newValues?.doc_no).toBe('A.1.3');
  });

  it('handles Needed Research parent change correctly (doc_no unchanged, ancestry changed)', () => {
    // Special case: Needed Research has global numbering, so doc_no can stay the same when parent changes
    const originalMaps: LookupMaps = {
      uuidToDoc: new Map([
        [
          'uuid-nr1',
          {
            type: 'Needed Research',
            doc_no: 'NR-1',
            name: 'Research',
            uuid: 'uuid-nr1',
            content: '',
            last_modified: '',
          },
        ],
      ]),
      docNoToDoc: new Map([
        [
          'NR-1',
          {
            type: 'Needed Research',
            doc_no: 'NR-1',
            name: 'Research',
            uuid: 'uuid-nr1',
            content: '',
            last_modified: '',
          },
        ],
      ]),
      uuidToAncestry: new Map([['uuid-nr1', ['uuid-scope', 'uuid-a1']]]),
    };

    const newMaps: LookupMaps = {
      uuidToDoc: new Map([
        [
          'uuid-nr1',
          {
            type: 'Needed Research',
            doc_no: 'NR-1',
            name: 'Research',
            uuid: 'uuid-nr1',
            content: '',
            last_modified: '',
          },
        ],
      ]),
      docNoToDoc: new Map([
        [
          'NR-1',
          {
            type: 'Needed Research',
            doc_no: 'NR-1',
            name: 'Research',
            uuid: 'uuid-nr1',
            content: '',
            last_modified: '',
          },
        ],
      ]),
      uuidToAncestry: new Map([['uuid-nr1', ['uuid-scope', 'uuid-a2']]]), // Different parent
    };

    const changes = detectChanges(originalMaps, newMaps, new Set(['uuid-nr1']), new Set(['uuid-nr1']));

    // Only parent_changed (doc_no unchanged, so NOT sibling_order_changed)
    expect(changes.added).toHaveLength(0);
    expect(changes.deleted).toHaveLength(0);
    expect(changes.changed).toHaveLength(0);
    expect(changes.parent_changed).toHaveLength(1);
    expect(changes.sibling_order_changed).toHaveLength(0); // NOT recorded (doc_no didn't change)

    expect(changes.parent_changed[0].uuid).toBe('uuid-nr1');
    expect(changes.parent_changed[0].oldValues?.doc_no).toBe('NR-1');
    expect(changes.parent_changed[0].newValues?.doc_no).toBe('NR-1'); // Same doc_no
  });
});
