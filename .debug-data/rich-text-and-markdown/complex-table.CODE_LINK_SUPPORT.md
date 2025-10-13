# Code + Link Combination Support

This test file (`complex-table.json`) contains Notion rich text elements that have **both** `code: true` **and** `href` set on the same element.

**Example from the JSON:**
```json
{
  "href": "https://etherscan.io/address/0x167c1a762B08D7e78dbF8f24e5C3f1Ab415021D3",
  "text": {
    "link": { "url": "https://..." },
    "content": "https://..."
  },
  "annotations": {
    "code": true
  }
}
```

## How We Support This

While standard Markdown **does not support** combining inline code formatting with links, we use a **special intermediate format** to enable perfect round-tripping:

### Our Format: `` [`code`](url) ``

We represent rich text elements with both code and link as:
```markdown
[`text content`](https://example.com)
```

This format:
- ✅ Preserves both the code annotation (`code: true`) and the link (`href`)
- ✅ Allows perfect round-tripping in both directions
- ✅ Works even with empty code blocks: `` [``](url) ``
- ⚠️ Is non-standard Markdown (doesn't render as expected in standard Markdown parsers)

### Why This Works

**Rich Text → Markdown:**
- Elements with `code: true` AND `href` are converted to `` [`content`](url) ``
- Backticks are escaped inside the code: `` [`text \`with\` backticks`](url) ``

**Markdown → Rich Text:**
- The pattern `` [`...`](url) `` is recognized and parsed as a special `code_link` type
- Creates a rich text element with both `annotations.code: true` and `href: url`
- Handles empty code blocks: `` [``](url) `` → `{ code: true, href: url, content: "" }`

## Round-Trip Behavior

Both directions now work perfectly:
- ✅ **Rich Text → Markdown → Rich Text**: All annotations and links preserved
- ✅ **Markdown → Rich Text → Markdown**: Perfect equality

## Implementation Details

The converters handle this through:

1. **Priority matching**: The `` [`...`](...) `` pattern is checked before regular inline code or links
2. **Empty content support**: Regex allows zero or more characters: `` `([^`]*)` ``
3. **URL preservation**: Both `code_link` and `link` types capture and store the URL

This approach prioritizes **data preservation** over strict Markdown compliance, which is appropriate for a round-trip conversion system.

