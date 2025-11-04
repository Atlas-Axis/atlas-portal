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
    });

    it('should not parse underscores as italics inside inline code', () => {
      const input = 'Use the `snake_case_variable` in your code.';
      const output = markdownToHTML(input);

      // Should NOT contain <em> tags from the underscores
      expect(output).not.toContain('<em>');

      // Should preserve the inline code
      expect(output).toContain('snake_case_variable');
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
    it('should convert UUID links to document number anchors', () => {
      const uuidToDocNoMap = new Map([['550e8400-e29b-41d4-a716-446655440000', 'A.1.2.3']]);

      const input = '[Link to doc](550e8400-e29b-41d4-a716-446655440000)';
      const output = markdownToHTML(input, uuidToDocNoMap);

      expect(output).toContain('href="#A.1.2.3"');
      expect(output).not.toContain('550e8400-e29b-41d4-a716-446655440000');
    });

    it('should preserve non-UUID links unchanged', () => {
      const uuidToDocNoMap = new Map([['550e8400-e29b-41d4-a716-446655440000', 'A.1.2.3']]);

      const input = '[External link](https://example.com)';
      const output = markdownToHTML(input, uuidToDocNoMap);

      expect(output).toContain('href="https://example.com"');
    });
  });
});
