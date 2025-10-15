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
      uuidToAncestry: new Map([['uuid-1', []]]),
    };

    const newMaps: LookupMaps = {
      uuidToDoc: new Map(),
      docNoToDoc: new Map(),
      uuidToAncestry: new Map(),
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

    expect(changes).toHaveLength(1);
    expect(changes[0].changeType).toBe('parent_changed');
    expect(changes[0].uuid).toBe('uuid-1');
    expect(changes[0].oldValues?.doc_no).toBe('A.1.1.1');
    expect(changes[0].newValues?.doc_no).toBe('A.1.2.1');
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

    expect(changes).toHaveLength(1);
    expect(changes[0].changeType).toBe('parent_changed');
    expect(changes[0].uuid).toBe('uuid-nr1');
    // doc_no stayed the same but parent changed
    expect(changes[0].oldValues?.doc_no).toBe('NR-1');
    expect(changes[0].newValues?.doc_no).toBe('NR-1');
    expect(changes[0].oldAncestry).toEqual(['uuid-scope', 'uuid-a1']);
    expect(changes[0].newAncestry).toEqual(['uuid-scope', 'uuid-a2']);
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
