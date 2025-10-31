import { describe, expect, it } from 'vitest';
import { processKaTeXInHTML } from '../process-katex';

describe('processKaTeXInHTML', () => {
  describe('inline math', () => {
    it('renders simple inline math expression', () => {
      const input = '<p>The value is $x = 5$.</p>';
      const output = processKaTeXInHTML(input);

      expect(output).toContain('<span class="katex">');
      expect(output).not.toContain('$x = 5$');
      expect(output).toContain('</p>');
    });

    it('renders multiple inline math expressions', () => {
      const input = '<p>Here $a = 1$ and $b = 2$ are values.</p>';
      const output = processKaTeXInHTML(input);

      expect(output).toContain('<span class="katex">');
      expect(output).not.toContain('$a = 1$');
      expect(output).not.toContain('$b = 2$');
      // Should have two separate KaTeX spans
      const katexCount = (output.match(/<span class="katex">/g) || []).length;
      expect(katexCount).toBe(2);
    });

    it('renders inline math with complex LaTeX', () => {
      const input = '<p>The formula $\\frac{a}{b}$ is a fraction.</p>';
      const output = processKaTeXInHTML(input);

      expect(output).toContain('<span class="katex">');
      expect(output).not.toContain('$\\frac{a}{b}$');
    });
  });

  describe('display math', () => {
    it('renders display math expression', () => {
      const input = '<p>$$\\frac{a}{b}$$</p>';
      const output = processKaTeXInHTML(input);

      expect(output).toContain('<span class="katex-display">');
      expect(output).toContain('<span class="katex">');
      expect(output).not.toContain('$$');
    });

    it('renders multiline display math', () => {
      const input = `<p>$$
\\text{PD} = N(-d_1) + N(-d_2)
$$</p>`;
      const output = processKaTeXInHTML(input);

      expect(output).toContain('<span class="katex-display">');
      expect(output).not.toContain('$$');
    });

    it('renders display math with complex formula', () => {
      const input = `<p>$$
\\text{PD} = N(-d_1) + N(-d_2) \\left( \\frac{\\sum_{i=1}^n \\text{LT}_i V_0^i}{\\sum_{j=1}^m D_0^j} \\right)^{-2a}
$$</p>`;
      const output = processKaTeXInHTML(input);

      expect(output).toContain('<span class="katex-display">');
      expect(output).not.toContain('$$');
    });

    it('removes leading and trailing <br> tags from display math', () => {
      const input = '<p>$$<br>\\frac{a}{b}<br>$$</p>';
      const output = processKaTeXInHTML(input);

      // Should successfully render the math
      expect(output).toContain('<span class="katex-display">');
      // Dollar signs should be gone
      expect(output).not.toContain('$$');
      // <br> tags should NOT appear between <p> and <span> (leading removed)
      expect(output).not.toMatch(/<p><br>\s*<span class="katex-display">/);
      // <br> tags should NOT appear between </span> and </p> (trailing removed)
      expect(output).not.toMatch(/<\/span>\s*<br><\/p>/);
      // The KaTeX span should be directly inside the <p> tag
      expect(output).toMatch(/<p><span class="katex-display">/);
    });

    it('removes <br> tags from middle of multiline display math', () => {
      const input = '<p>$$<br>\\text{Line 1}<br>\\text{Line 2}<br>$$</p>';
      const output = processKaTeXInHTML(input);

      // Should successfully render (KaTeX will handle the space instead of <br>)
      expect(output).toContain('<span class="katex-display">');
      expect(output).not.toContain('$$');
      // No <br> tags should remain in the output
      expect(output).not.toMatch(/<span class="katex-display">.*<br>.*<\/span>/);
    });
  });

  describe('mixed content', () => {
    it('renders both inline and display math in same string', () => {
      const input = '<p>The first step is calculating $PD$. $$\\text{PD} = N(-d_1)$$</p>';
      const output = processKaTeXInHTML(input);

      // Should contain both inline and display math
      expect(output).toContain('<span class="katex">');
      expect(output).toContain('<span class="katex-display">');
      expect(output).not.toContain('$PD$');
      expect(output).not.toContain('$$');
    });

    it('renders a real example HTML from the Atlas', () => {
      const input = `<div><p>The first step is calculating the Probability Of Default $PD$. $PD$ is calculated using the following formula:</p>
<p>$$
\\text{PD} = N(-d_1) + N(-d_2) \\left( \\frac{\\sum_{i=1}^n \\text{LT}_i V_0^i}{\\sum_{j=1}^m D_0^j} \\right)^{-2a}
$$</p>
<p>Here $N$ is the normal cumulative probability distribution function.</p>
<p>The parameters of this formula are specified in the subdocuments herein.</p></div>`;

      const output = processKaTeXInHTML(input);

      // Should not contain any dollar signs
      expect(output).not.toContain('$PD$');
      expect(output).not.toContain('$$');
      expect(output).not.toContain('$N$');

      // Should contain KaTeX spans
      expect(output).toContain('<span class="katex">');
      expect(output).toContain('<span class="katex-display">');

      // Should preserve other HTML structure
      expect(output).toContain('<div>');
      expect(output).toContain('</div>');
      expect(output).toContain('<p>');
    });
  });

  describe('edge cases', () => {
    it('passes through HTML without math expressions unchanged', () => {
      const input = '<p>This is plain text without any math.</p>';
      const output = processKaTeXInHTML(input);

      expect(output).toBe(input);
    });

    it('handles empty string', () => {
      const input = '';
      const output = processKaTeXInHTML(input);

      expect(output).toBe('');
    });

    it('handles invalid LaTeX gracefully', () => {
      const input = '<p>Invalid math: $\\invalid{command}$</p>';
      const output = processKaTeXInHTML(input);

      // With throwOnError: false, KaTeX should render the error in red
      expect(output).toContain('<span class="katex">');
      // The error should be rendered, not the original string
      expect(output).not.toContain('$\\invalid{command}$');
    });

    it('handles multiple consecutive dollar signs correctly', () => {
      // Display math should be processed first, so $$$ should become $ after display processing
      const input = '<p>$$$x = 5$$$</p>';
      const output = processKaTeXInHTML(input);

      // The middle $x = 5$ should be rendered as display math
      expect(output).toContain('<span class="katex');
    });

    it('handles empty math delimiters', () => {
      const input = '<p>Empty inline: $$ and display: $$$$</p>';
      const output = processKaTeXInHTML(input);

      // KaTeX should handle empty expressions (may render as empty or minimal content)
      expect(output).toContain('<span class="katex');
    });

    it('preserves HTML entities and special characters', () => {
      const input = '<p>Text with &amp; entity and $x = 5$ math.</p>';
      const output = processKaTeXInHTML(input);

      expect(output).toContain('&amp;');
      expect(output).toContain('<span class="katex">');
    });

    it('handles math expressions in different HTML tags', () => {
      const input = '<div>$a$</div><span>$b$</span><li>$c$</li>';
      const output = processKaTeXInHTML(input);

      const katexCount = (output.match(/<span class="katex">/g) || []).length;
      expect(katexCount).toBe(3);
      expect(output).toContain('<div>');
      expect(output).toContain('<span>');
      expect(output).toContain('<li>');
    });

    it('does not convert dollar signs representing money to KaTeX', () => {
      const input = '<p>Value 1: $1,000; Value 2: $50</p>';
      const output = processKaTeXInHTML(input);

      // Dollar signs followed by digits should NOT be treated as math (money amounts)
      expect(output).not.toContain('<span class="katex">');
      // Money amounts should remain unchanged
      expect(output).toContain('$1,000');
      expect(output).toContain('$50');
      // The original HTML structure should be preserved
      expect(output).toBe(input);
    });

    it('still converts valid math expressions that contain numbers', () => {
      const input = '<p>The equation $x = 5$ is simple, and $y + 10 = z$ too.</p>';
      const output = processKaTeXInHTML(input);

      // Math expressions with variables and numbers should still be converted
      expect(output).toContain('<span class="katex">');
      // Should not contain the original dollar-delimited expressions
      expect(output).not.toContain('$x = 5$');
      expect(output).not.toContain('$y + 10 = z$');
      // Should have converted both expressions
      const katexCount = (output.match(/<span class="katex">/g) || []).length;
      expect(katexCount).toBe(2);
    });
  });

  describe('KaTeX HTML structure verification', () => {
    it('inline math creates katex span without katex-display', () => {
      const input = '$x = 5$';
      const output = processKaTeXInHTML(input);

      expect(output).toContain('<span class="katex">');
      expect(output).not.toContain('katex-display');
    });

    it('display math creates katex-display span', () => {
      const input = '$$x = 5$$';
      const output = processKaTeXInHTML(input);

      expect(output).toContain('<span class="katex-display">');
      expect(output).toContain('<span class="katex">');
    });
  });
});
