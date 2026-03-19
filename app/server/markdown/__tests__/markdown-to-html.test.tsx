import { describe, expect, it } from 'vitest';
import { markdownToHTML } from '../markdown-to-html';

describe('markdownToHTML', () => {
  describe('math expression protection', () => {
    it('should not parse underscores as italics inside display math', () => {
      const input =
        '$$\\text{Util}_{\\mathrm{avg}} = \\frac{\\sum_{i=0}^{n-1} U_i \\cdot (t_{i+1} - t_i)}{T_n - T_0}$$';
      const output = markdownToHTML(input);

      // Should NOT contain <em> tags
      expect(output).not.toContain('<em>');

      // Should preserve the original math formula
      expect(output).toContain('\\text{Util}_{\\mathrm{avg}}');
      expect(output).toContain('\\sum_{i=0}^{n-1}');
      expect(output).toContain('U_i');
      expect(output).toContain('t_{i+1}');
      expect(output).toContain('T_n');
      expect(output).toContain('T_0');
    });

    it('should not parse underscores as italics inside inline math', () => {
      const input = 'The average utility $U_{avg}$ is calculated.';
      const output = markdownToHTML(input);

      // Should NOT contain <em> tags
      expect(output).not.toContain('<em>');

      // Should preserve the inline math
      expect(output).toContain('$U_{avg}$');
    });

    it('should not parse underscores as italics inside code blocks', () => {
      const input = '```python\ndef calculate_sum(n_items):\n    return sum_total\n```';
      const output = markdownToHTML(input);

      // Should NOT contain <em> tags
      expect(output).not.toContain('<em>');

      // Should preserve the underscores in code
      expect(output).toContain('n_items');
      expect(output).toContain('sum_total');

      // Should render as HTML with <pre> and <code> tags
      expect(output).toContain('<pre>');
      expect(output).toContain('<code');
      expect(output).toContain('</code>');
      expect(output).toContain('</pre>');
    });

    it('should not parse underscores as italics inside inline code', () => {
      const input = 'Use the `snake_case_variable` in your code.';
      const output = markdownToHTML(input);

      // Should NOT contain <em> tags from the underscores
      expect(output).not.toContain('<em>');

      // Should preserve the inline code
      expect(output).toContain('snake_case_variable');

      // Should render as HTML with <code> tag
      expect(output).toContain('<code>snake_case_variable</code>');
    });

    it('should still parse underscores as italics in regular text', () => {
      const input = 'This text has _italic_ formatting.';
      const output = markdownToHTML(input);

      // Should contain <em> tags for legitimate italics
      expect(output).toContain('<em>italic</em>');
    });

    it('should handle mixed content with math and regular italics', () => {
      const input = 'The formula $U_{avg}$ represents _average_ utility.';
      const output = markdownToHTML(input);

      // Should contain <em> for the word "average"
      expect(output).toContain('<em>average</em>');

      // Should NOT parse underscores in math as italics
      expect(output).toContain('$U_{avg}$');

      // Should only have one <em> tag pair (for "average")
      const emCount = (output.match(/<em>/g) || []).length;
      expect(emCount).toBe(1);
    });

    it('should preserve complex math formulas with multiple underscores', () => {
      const input = '$$\\text{Result}_{final} = \\sum_{i=1}^{n} x_i \\cdot y_i + z_{max}$$';
      const output = markdownToHTML(input);

      // Should NOT contain any <em> tags
      expect(output).not.toContain('<em>');

      // Should preserve all parts of the formula
      expect(output).toContain('\\text{Result}_{final}');
      expect(output).toContain('\\sum_{i=1}^{n}');
      expect(output).toContain('x_i');
      expect(output).toContain('y_i');
      expect(output).toContain('z_{max}');
    });

    it('should handle the exact example from the bug report', () => {
      const input =
        '$$\\text{Util}_{\\mathrm{avg}} = \\frac{\\sum_{i=0}^{n-1} U_i \\cdot (t_{i+1} - t_i)}{T_n - T_0}$$';
      const output = markdownToHTML(input);

      // The exact bug: should NOT produce <em>{\mathrm{avg}} = \frac{\sum</em>
      expect(output).not.toMatch(/\$\$\\text\{Util\}<em>/);
      expect(output).not.toContain('<em>{\\mathrm{avg}}');

      // Should preserve the formula intact
      expect(output).toContain(
        '$$\\text{Util}_{\\mathrm{avg}} = \\frac{\\sum_{i=0}^{n-1} U_i \\cdot (t_{i+1} - t_i)}{T_n - T_0}$$',
      );
    });

    it('should handle multiple math blocks in sequence', () => {
      const input = '$$x_1$$ and $$y_2$$ are both formulas.';
      const output = markdownToHTML(input);

      // Should NOT contain <em> tags
      expect(output).not.toContain('<em>');

      // Should preserve both formulas
      expect(output).toContain('$$x_1$$');
      expect(output).toContain('$$y_2$$');
    });

    it('should handle math with asterisks (which could be bold markers)', () => {
      const input = '$$x^* = \\arg\\max_{x} f(x)$$';
      const output = markdownToHTML(input);

      // Should NOT contain <strong> tags
      expect(output).not.toContain('<strong>');

      // Should preserve the formula
      expect(output).toContain('x^*');
      expect(output).toContain('\\arg\\max_{x}');
    });

    it('should handle code blocks with various markdown-like characters', () => {
      const input = '```javascript\nconst value_a = *ptr_b;\nconst sum_total = a_1 + b_2;\n```';
      const output = markdownToHTML(input);

      // Should NOT contain <em> or <strong> tags from the content
      expect(output).not.toMatch(/<p>.*<em>.*<\/em>.*<\/p>/);
      expect(output).not.toMatch(/<code>.*<em>.*<\/em>.*<\/code>/);

      // Should preserve the code content
      expect(output).toContain('value_a');
      expect(output).toContain('ptr_b');
      expect(output).toContain('sum_total');
      expect(output).toContain('a_1');
      expect(output).toContain('b_2');

      // Should render as HTML with <pre> and <code> tags
      expect(output).toContain('<pre>');
      expect(output).toContain('<code');
      expect(output).toContain('</code>');
      expect(output).toContain('</pre>');
    });
  });

  describe('code rendering as HTML', () => {
    it('should render inline code with proper HTML tags', () => {
      const input = 'The function `myFunction()` returns a value.';
      const output = markdownToHTML(input);

      expect(output).toContain('<code>myFunction()</code>');
      expect(output).toContain('<p>');
    });

    it('should render code blocks with proper HTML structure', () => {
      const input = '```\nfunction test() {\n  return true;\n}\n```';
      const output = markdownToHTML(input);

      expect(output).toContain('<pre>');
      expect(output).toContain('<code');
      expect(output).toContain('function test()');
      expect(output).toContain('return true;');
      expect(output).toContain('</code>');
      expect(output).toContain('</pre>');
    });

    it('should render code blocks with language specification', () => {
      const input = '```javascript\nconst x = 42;\n```';
      const output = markdownToHTML(input);

      expect(output).toContain('<pre>');
      expect(output).toContain('<code');
      expect(output).toContain('const x = 42;');
      expect(output).toContain('</code>');
      expect(output).toContain('</pre>');
    });

    it('should render multiple inline code elements', () => {
      const input = 'Compare `foo` with `bar` and `baz`.';
      const output = markdownToHTML(input);

      expect(output).toContain('<code>foo</code>');
      expect(output).toContain('<code>bar</code>');
      expect(output).toContain('<code>baz</code>');
    });

    it('should render empty inline code', () => {
      const input = 'Empty code: ``';
      const output = markdownToHTML(input);

      // markdown-it may render empty code differently, but it should at least process it
      expect(output).toContain('Empty code:');
    });
  });

  describe('basic markdown functionality', () => {
    it('should convert simple paragraph', () => {
      const input = 'Hello world';
      const output = markdownToHTML(input);

      expect(output).toContain('<p>');
      expect(output).toContain('Hello world');
      expect(output).toContain('</p>');
    });

    it('should convert headers', () => {
      const input = '# Heading 1\n## Heading 2';
      const output = markdownToHTML(input);

      expect(output).toContain('<h1>');
      expect(output).toContain('Heading 1');
      expect(output).toContain('<h2>');
      expect(output).toContain('Heading 2');
    });

    it('should convert bold text', () => {
      const input = 'This is **bold** text';
      const output = markdownToHTML(input);

      expect(output).toContain('<strong>bold</strong>');
    });

    it('should convert italic text with underscores', () => {
      const input = 'This is _italic_ text';
      const output = markdownToHTML(input);

      expect(output).toContain('<em>italic</em>');
    });

    it('should convert italic text with asterisks', () => {
      const input = 'This is *italic* text';
      const output = markdownToHTML(input);

      expect(output).toContain('<em>italic</em>');
    });

    it('should convert links', () => {
      const input = '[Link text](https://example.com)';
      const output = markdownToHTML(input);

      expect(output).toContain('<a href="https://example.com">');
      expect(output).toContain('Link text');
      expect(output).toContain('</a>');
    });
  });

  describe('UUID link conversion', () => {
    it('should convert UUID links to UUID-based anchor links', () => {
      const uuidToDocNoMap = new Map([['550e8400-e29b-41d4-a716-446655440000', 'A.1.2.3']]);

      const input = '[Link to doc](550e8400-e29b-41d4-a716-446655440000)';
      const output = markdownToHTML(input, uuidToDocNoMap);

      expect(output).toContain('href="#550e8400-e29b-41d4-a716-446655440000"');
    });

    it('should preserve non-UUID links unchanged', () => {
      const uuidToDocNoMap = new Map([['550e8400-e29b-41d4-a716-446655440000', 'A.1.2.3']]);

      const input = '[External link](https://example.com)';
      const output = markdownToHTML(input, uuidToDocNoMap);

      expect(output).toContain('href="https://example.com"');
    });
  });

  describe('bullet character normalization', () => {
    it('should convert Unicode white bullet (◦) to standard list items', () => {
      const input = '◦ First item\n◦ Second item';
      const output = markdownToHTML(input);

      // Should render as proper list items
      expect(output).toContain('<ul>');
      expect(output).toContain('<li>');
      expect(output).toContain('First item');
      expect(output).toContain('Second item');
      expect(output).toContain('</li>');
      expect(output).toContain('</ul>');

      // Should NOT contain the original Unicode bullet character
      expect(output).not.toContain('◦');
    });

    it('should convert Unicode bullet (•) to standard list items', () => {
      const input = '• First item\n• Second item';
      const output = markdownToHTML(input);

      // Should render as proper list items
      expect(output).toContain('<ul>');
      expect(output).toContain('<li>');
      expect(output).toContain('First item');
      expect(output).toContain('Second item');
      expect(output).toContain('</li>');
      expect(output).toContain('</ul>');

      // Should NOT contain the original Unicode bullet character
      expect(output).not.toContain('•');
    });

    it('should handle indented Unicode bullets for nested lists', () => {
      const input = '- Main item\n  ◦ Sub item 1\n  ◦ Sub item 2';
      const output = markdownToHTML(input);

      // Should render with nested list structure
      expect(output).toContain('<ul>');
      expect(output).toContain('<li>');
      expect(output).toContain('Main item');
      expect(output).toContain('Sub item 1');
      expect(output).toContain('Sub item 2');
      expect(output).toContain('</li>');
      expect(output).toContain('</ul>');

      // Should NOT contain the original Unicode bullet character
      expect(output).not.toContain('◦');
    });

    it('should handle mixed standard dashes and Unicode bullets', () => {
      const input = '- First level\n  ◦ Second level with circle\n- Another first level';
      const output = markdownToHTML(input);

      // Should render both as list items
      expect(output).toContain('<ul>');
      expect(output).toContain('First level');
      expect(output).toContain('Second level with circle');
      expect(output).toContain('Another first level');

      // Should NOT contain the original Unicode bullet character
      expect(output).not.toContain('◦');
    });

    it('should handle the exact content from Atlas document A.1.9.2.4.12.3.3.1', () => {
      const input = `- The check can be performed in two ways:

1. Using an Online Tool:

  ◦ Copy and paste the body of the Executive Document.

  ◦ Compare the generated hash with the hash included in the Spell.`;

      const output = markdownToHTML(input);

      // Should render the dash item as a list
      expect(output).toContain('<ul>');
      expect(output).toContain('The check can be performed in two ways');

      // Should NOT contain the original Unicode bullet character
      expect(output).not.toContain('◦');

      // Should contain the sub-items as list items
      expect(output).toContain('Copy and paste the body');
      expect(output).toContain('Compare the generated hash');
    });

    it('should not affect Unicode bullets that are not at the start of a line', () => {
      const input = 'This text mentions the ◦ symbol in the middle of a sentence.';
      const output = markdownToHTML(input);

      // The bullet in the middle of text should remain
      expect(output).toContain('◦');
    });

    it('should preserve standard dash list markers', () => {
      const input = '- Standard dash item\n- Another dash item';
      const output = markdownToHTML(input);

      // Should render as proper list items
      expect(output).toContain('<ul>');
      expect(output).toContain('<li>');
      expect(output).toContain('Standard dash item');
      expect(output).toContain('Another dash item');
    });
  });

  describe('malformed inline code fix', () => {
    it('should fix inline code with closing backtick on new line followed by list item', () => {
      // This malformed pattern occurs when Notion exports inline code incorrectly
      const input = `  - Generate the hash:
     - Run the command: \`cast keccak
\`     - Use the raw file URL.`;

      const output = markdownToHTML(input);

      // Should have 3 separate list items
      const liCount = (output.match(/<li>/g) || []).length;
      expect(liCount).toBe(3);

      // "Use the raw file URL" should be its own list item, not on the same line as the code
      expect(output).toContain('<li>Use the raw file URL.</li>');
    });

    it('should not affect properly formatted inline code', () => {
      const input = '- Item with `code` in it\n- Another item';
      const output = markdownToHTML(input);

      // Should render normally
      expect(output).toContain('<code>code</code>');
      expect(output).toContain('<li>');
      const liCount = (output.match(/<li>/g) || []).length;
      expect(liCount).toBe(2);
    });

    it('should handle the exact malformed content from Atlas document A.1.9.2.4.12.3.3.1', () => {
      // Exact content structure from the problematic document
      const input = `  - Generate the hash directly from the raw GitHub URL at the specific commit:
     - Run the following command to generate the hash: \`cast keccak -- "$(wget $RAW_EXEC_URL -O -)"
\`     - Use the raw file URL at the specific commit.

  - Compare the generated hash with the hash included in the Spell.`;

      const output = markdownToHTML(input);

      // Should have 4 separate list items
      const liCount = (output.match(/<li>/g) || []).length;
      expect(liCount).toBe(4);

      // Each should be a separate list item
      expect(output).toContain('Generate the hash directly');
      expect(output).toContain('Run the following command');
      expect(output).toContain('<li>Use the raw file URL at the specific commit.</li>');
      expect(output).toContain('Compare the generated hash');
    });
  });

  describe('table rendering', () => {
    it('should render tables without invalid <br> tags inside table structure', () => {
      const input = `| Header 1 | Header 2 |
|----------|----------|
| Cell 1   | Cell 2   |
| Cell 3   | Cell 4   |`;

      const output = markdownToHTML(input);

      // Should NOT contain <br> tags inside table elements
      expect(output).not.toMatch(/<table[^>]*><br>/);
      expect(output).not.toMatch(/<thead[^>]*><br>/);
      expect(output).not.toMatch(/<tbody[^>]*><br>/);
      expect(output).not.toMatch(/<tr[^>]*><br>/);
      expect(output).not.toMatch(/<th[^>]*>.*<br>/);
      expect(output).not.toMatch(/<td[^>]*>.*<br>/);
      expect(output).not.toMatch(/<br>\s*<\/thead>/);
      expect(output).not.toMatch(/<br>\s*<\/tbody>/);
      expect(output).not.toMatch(/<br>\s*<\/tr>/);
      expect(output).not.toMatch(/<br>\s*<\/th>/);
      expect(output).not.toMatch(/<br>\s*<\/td>/);
      expect(output).not.toMatch(/<br>\s*<\/table>/);
    });

    it('should render table with proper HTML structure', () => {
      const input = `| Name | Age |
|------|-----|
| John | 30  |
| Jane | 25  |`;

      const output = markdownToHTML(input);

      // Should contain proper table structure
      expect(output).toContain('<table>');
      expect(output).toContain('<thead>');
      expect(output).toContain('<tbody>');
      expect(output).toContain('</table>');

      // Should contain header cells
      expect(output).toContain('<th>Name</th>');
      expect(output).toContain('<th>Age</th>');

      // Should contain data cells
      expect(output).toContain('<td>John</td>');
      expect(output).toContain('<td>30</td>');
      expect(output).toContain('<td>Jane</td>');
      expect(output).toContain('<td>25</td>');
    });

    it('should render table with links without invalid <br> tags', () => {
      const input = `| Date       | Link |
|------------|------|
| 2023-06-08 | [https://example.com/1](https://example.com/1) |
| 2024-04-06 | [https://example.com/2](https://example.com/2) |`;

      const output = markdownToHTML(input);

      // Should contain proper links
      expect(output).toContain('href="https://example.com/1"');
      expect(output).toContain('href="https://example.com/2"');

      // Should NOT contain <br> tags inside table structure
      expect(output).not.toMatch(/<table[^>]*><br>/);
      expect(output).not.toMatch(/<thead[^>]*><br>/);
      expect(output).not.toMatch(/<tbody[^>]*><br>/);
      expect(output).not.toMatch(/<tr[^>]*><br>/);
    });

    it('should handle the exact bug case from the user report', () => {
      const input = `| Date       | Conserver Role    | Identity               | Known Aliases | Reasoning Post                                                                                                    |
|------------|--------------------|------------------------|---------------|-------------------------------------------------------------------------------------------------------------------|
| 2023-06-08 | AVC Member         | HKUST_EPI_BLOCKCHAIN   | -             | [https://forum.sky.money/t/notice-aligned-delegate-derecognition-and-avc-member-warning/21099](https://forum.sky.money/t/notice-aligned-delegate-derecognition-and-avc-member-warning/21099)                     |
| 2024-04-06 | AVC Member         | ACRE DAOs              | -             | [https://forum.sky.money/t/ad-derecognition-due-to-operational-security-breach-april-5-2024/24043](https://forum.sky.money/t/ad-derecognition-due-to-operational-security-breach-april-5-2024/24043)                 |
| 2025-08-15 | Aligned Delegate   | SkyStaking             | -             | [https://forum.sky.money/t/atlas-edit-weekly-cycle-proposal-week-of-2025-08-04/26957/9](https://forum.sky.money/t/atlas-edit-weekly-cycle-proposal-week-of-2025-08-04/26957/9)                            |`;

      const output = markdownToHTML(input);

      // The critical bug: should NOT have <br> tags scattered throughout the table
      expect(output).not.toMatch(/<table[^>]*><br>/);
      expect(output).not.toMatch(/<thead[^>]*><br>/);
      expect(output).not.toMatch(/<tbody[^>]*><br>/);
      expect(output).not.toMatch(/<tr[^>]*><br>/);

      // Should have proper table structure
      expect(output).toContain('<table>');
      expect(output).toContain('<thead>');
      expect(output).toContain('<tbody>');
      expect(output).toContain('</table>');

      // Should have all the header columns
      expect(output).toContain('<th>Date</th>');
      expect(output).toContain('<th>Conserver Role</th>');
      expect(output).toContain('<th>Identity</th>');
      expect(output).toContain('<th>Known Aliases</th>');
      expect(output).toContain('<th>Reasoning Post</th>');

      // Should have the data cells with proper content
      expect(output).toContain('HKUST_EPI_BLOCKCHAIN');
      expect(output).toContain('ACRE DAOs');
      expect(output).toContain('SkyStaking');

      // Should have the links
      expect(output).toContain(
        'href="https://forum.sky.money/t/notice-aligned-delegate-derecognition-and-avc-member-warning/21099"',
      );
      expect(output).toContain(
        'href="https://forum.sky.money/t/ad-derecognition-due-to-operational-security-breach-april-5-2024/24043"',
      );
      expect(output).toContain(
        'href="https://forum.sky.money/t/atlas-edit-weekly-cycle-proposal-week-of-2025-08-04/26957/9"',
      );

      // Count <br> tags - should not have excessive line breaks
      // There should be zero <br> tags in valid table HTML
      const brCount = (output.match(/<br>/g) || []).length;
      expect(brCount).toBe(0);
    });

    it('should render complex table with alignment without <br> tags', () => {
      const input = `| Left | Center | Right |
|:-----|:------:|------:|
| L1   | C1     | R1    |
| L2   | C2     | R2    |`;

      const output = markdownToHTML(input);

      // Should have proper structure
      expect(output).toContain('<table>');
      expect(output).toContain('<thead>');
      expect(output).toContain('<tbody>');

      // Should NOT contain <br> tags in table structure
      expect(output).not.toMatch(/<table[^>]*><br>/);
      expect(output).not.toMatch(/<thead[^>]*><br>/);
      expect(output).not.toMatch(/<tbody[^>]*><br>/);
      expect(output).not.toMatch(/<tr[^>]*><br>/);
    });

    it('should render single-row table without <br> tags', () => {
      const input = `| Column A | Column B |
|----------|----------|
| Value A  | Value B  |`;

      const output = markdownToHTML(input);

      // Should have table
      expect(output).toContain('<table>');
      expect(output).toContain('Column A');
      expect(output).toContain('Value A');

      // Should NOT have <br> tags inside table
      expect(output).not.toMatch(/<table[^>]*><br>/);
      expect(output).not.toMatch(/<thead[^>]*><br>/);
      expect(output).not.toMatch(/<tbody[^>]*><br>/);
      expect(output).not.toMatch(/<tr[^>]*><br>/);
    });
  });
});
