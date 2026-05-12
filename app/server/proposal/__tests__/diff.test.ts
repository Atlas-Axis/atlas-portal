// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { escapeHtml, lineDiff, wordDiff } from '../diff';

describe('escapeHtml', () => {
  it('escapes HTML special characters', () => {
    expect(escapeHtml('a < b & c > d')).toBe('a &lt; b &amp; c &gt; d');
    expect(escapeHtml('"quoted"')).toBe('&quot;quoted&quot;');
    expect(escapeHtml("it's")).toBe('it&#x27;s');
  });
});

describe('wordDiff', () => {
  it('returns empty string when both inputs are empty', () => {
    expect(wordDiff('', '')).toBe('');
  });

  it('marks the whole text as added when old is empty', () => {
    expect(wordDiff('', 'hello world')).toBe('<span class="added">hello world</span>');
  });

  it('marks the whole text as removed when new is empty', () => {
    expect(wordDiff('hello world', '')).toBe('<span class="removed">hello world</span>');
  });

  it('produces no diff markup when texts are identical', () => {
    const out = wordDiff('the quick brown fox', 'the quick brown fox');
    expect(out).toBe('the quick brown fox');
    expect(out).not.toContain('added');
    expect(out).not.toContain('removed');
  });

  it('highlights replaced words', () => {
    const out = wordDiff('the quick brown fox', 'the slow brown fox');
    expect(out).toContain('<span class="removed">quick</span>');
    expect(out).toContain('<span class="added">slow</span>');
    expect(out).toContain('the ');
    expect(out).toContain(' brown fox');
  });

  it('highlights inserted words', () => {
    const out = wordDiff('the fox', 'the quick fox');
    expect(out).toContain('<span class="added">');
    expect(out).toContain('quick');
  });

  it('highlights deleted words', () => {
    const out = wordDiff('the quick fox', 'the fox');
    expect(out).toContain('<span class="removed">');
    expect(out).toContain('quick');
  });

  it('escapes HTML in tokens', () => {
    const out = wordDiff('a < b', 'a > b');
    // The character that changes is on either side of `b`; the key point is
    // that the raw `<` or `>` never makes it through unescaped.
    expect(out).not.toMatch(/<\s*[<>]\s*/);
    expect(out).toContain('&lt;');
    expect(out).toContain('&gt;');
  });

  it('preserves markdown links as single tokens', () => {
    // The link as a whole changes (URL different) — token should be one unit.
    const out = wordDiff('see [docs](http://old.example)', 'see [docs](http://new.example)');
    expect(out).toContain('<span class="removed">[docs](http://old.example)</span>');
    expect(out).toContain('<span class="added">[docs](http://new.example)</span>');
  });

  it('treats trailing punctuation separately so word changes do not flag punctuation', () => {
    const out = wordDiff('Wallet;', 'Wallet;');
    // Identical — no diff markup at all.
    expect(out).toBe('Wallet;');
  });

  it('merges short equal blocks between changes into one phrase-level replacement', () => {
    // Without merging, "the" would anchor the diff and produce alternating
    // remove/add pairs. With merging, we get one cleaner replacement.
    const out = wordDiff('foo the bar', 'baz the qux');
    // Should be a single removed/added pair, not two interleaved pairs.
    const removedCount = (out.match(/class="removed"/g) ?? []).length;
    const addedCount = (out.match(/class="added"/g) ?? []).length;
    expect(removedCount).toBe(1);
    expect(addedCount).toBe(1);
    // And the merged removed block should include "the".
    expect(out).toMatch(/<span class="removed">foo the bar<\/span>/);
    expect(out).toMatch(/<span class="added">baz the qux<\/span>/);
  });
});

describe('lineDiff', () => {
  it('returns empty string when both inputs are empty', () => {
    expect(lineDiff('', '')).toBe('');
  });

  it('marks all new lines as added when old is empty', () => {
    const out = lineDiff('', 'line1\nline2');
    expect(out).toContain('added-line');
    expect(out).toContain('line1');
    expect(out).toContain('line2');
  });

  it('marks all old lines as removed when new is empty', () => {
    const out = lineDiff('line1\nline2', '');
    expect(out).toContain('removed-line');
  });

  it('produces context lines for equal sections', () => {
    const out = lineDiff('a\nb\nc', 'a\nb\nc');
    expect(out).toContain('class="line context"');
    expect(out).not.toContain('added');
    expect(out).not.toContain('removed');
  });

  it('renders replace blocks with word-level highlighting per line pair', () => {
    const out = lineDiff('hello world', 'hello there');
    expect(out).toContain('changed-line');
    expect(out).toContain('<span class="removed">world</span>');
    expect(out).toContain('<span class="added">there</span>');
  });

  it('escapes HTML in lines', () => {
    const out = lineDiff('<a>', '<b>');
    expect(out).toContain('&lt;a&gt;');
    expect(out).toContain('&lt;b&gt;');
    expect(out).not.toMatch(/<a>(?!\/)/);
  });
});
