// @vitest-environment node
import { describe, expect, it } from 'vitest';
import type { ParsedDoc } from '../../atlas/compose';
import { detectAtomTreeChanges } from '../atom-tree-diff';

function doc(partial: Partial<ParsedDoc>): ParsedDoc {
  return {
    folderPath: ['A', '0'],
    uuid: 'unset-uuid',
    docNo: 'A.0',
    name: 'Doc',
    docType: 'Scope',
    depth: 1,
    childType: 'sections_and_primary_docs',
    targets: [],
    contentLines: [],
    ...partial,
  };
}

describe('detectAtomTreeChanges', () => {
  it('returns empty when base and head are identical', () => {
    const docs: ParsedDoc[] = [doc({ uuid: 'u1', docNo: 'A.0', name: 'X', contentLines: ['body'] })];
    expect(detectAtomTreeChanges(docs, docs)).toEqual([]);
  });

  it('detects added docs', () => {
    const base: ParsedDoc[] = [doc({ uuid: 'u1', docNo: 'A.0' })];
    const head: ParsedDoc[] = [
      doc({ uuid: 'u1', docNo: 'A.0' }),
      doc({ uuid: 'u2', docNo: 'A.1', name: 'New', contentLines: ['hello'] }),
    ];
    const changes = detectAtomTreeChanges(base, head);
    expect(changes).toHaveLength(1);
    expect(changes[0].kind).toBe('added');
    expect(changes[0].current?.uuid).toBe('u2');
  });

  it('detects removed docs', () => {
    const base: ParsedDoc[] = [doc({ uuid: 'u1' }), doc({ uuid: 'u2', docNo: 'A.1', name: 'Gone' })];
    const head: ParsedDoc[] = [doc({ uuid: 'u1' })];
    const changes = detectAtomTreeChanges(base, head);
    expect(changes).toHaveLength(1);
    expect(changes[0].kind).toBe('removed');
    expect(changes[0].base?.uuid).toBe('u2');
  });

  it('detects body changes', () => {
    const base: ParsedDoc[] = [doc({ uuid: 'u1', contentLines: ['old body'] })];
    const head: ParsedDoc[] = [doc({ uuid: 'u1', contentLines: ['new body'] })];
    const changes = detectAtomTreeChanges(base, head);
    expect(changes).toHaveLength(1);
    expect(changes[0].kind).toBe('modified');
    expect(changes[0].base?.contentLines).toEqual(['old body']);
    expect(changes[0].current?.contentLines).toEqual(['new body']);
  });

  it('detects name changes', () => {
    const base: ParsedDoc[] = [doc({ uuid: 'u1', name: 'Old Name' })];
    const head: ParsedDoc[] = [doc({ uuid: 'u1', name: 'New Name' })];
    const changes = detectAtomTreeChanges(base, head);
    expect(changes).toHaveLength(1);
    expect(changes[0].kind).toBe('modified');
  });

  it('ignores pure renumbering (docNo change with same body and name)', () => {
    const base: ParsedDoc[] = [doc({ uuid: 'u1', docNo: 'A.1', name: 'Same', contentLines: ['x'] })];
    const head: ParsedDoc[] = [doc({ uuid: 'u1', docNo: 'A.2', name: 'Same', contentLines: ['x'] })];
    const changes = detectAtomTreeChanges(base, head);
    expect(changes).toEqual([]);
  });

  it('skips docs without UUIDs', () => {
    const base: ParsedDoc[] = [doc({ uuid: '', contentLines: ['x'] })];
    const head: ParsedDoc[] = [doc({ uuid: '', contentLines: ['y'] })];
    const changes = detectAtomTreeChanges(base, head);
    expect(changes).toEqual([]);
  });

  it('returns changes sorted: added then modified then removed, each by docNo', () => {
    const base: ParsedDoc[] = [
      doc({ uuid: 'u1', docNo: 'A.1', contentLines: ['v1'] }),
      doc({ uuid: 'u2', docNo: 'A.2' }),
    ];
    const head: ParsedDoc[] = [
      doc({ uuid: 'u1', docNo: 'A.1', contentLines: ['v2'] }), // modified
      doc({ uuid: 'u3', docNo: 'A.3', name: 'New' }), // added
      // u2 removed
    ];
    const changes = detectAtomTreeChanges(base, head);
    expect(changes.map((c) => c.kind)).toEqual(['added', 'modified', 'removed']);
  });
});
