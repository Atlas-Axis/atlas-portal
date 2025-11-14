# Atlas Markdown Import/Export

## Overview

The Atlas Markdown import/export system provides a human-readable, version-controllable format for the entire Atlas document hierarchy. It enables:

- **Export**: Convert Atlas data from Supabase (Rich Text) to Markdown format
- **Import**: Parse Atlas Markdown back into structured `ExportAtlasTreeScopeTrees`
- **Validation**: Verify Atlas Markdown syntax before import
- **Round-trip**: Export → Import maintains data fidelity

## Exporting to Markdown

### Programmatic Export

```typescript
import { buildAtlasMarkdown, buildAtlasMarkdownsPerScope } from '@/app/server/atlas/export/atlas-markdown-exporter';

// Export entire Atlas as single markdown file
const markdown = await buildAtlasMarkdown();

// Export as separate files per scope
const markdownsByScope = await buildAtlasMarkdownsPerScope();
// Returns: { "A.1 - The Governance Scope": "# A.1...", "A.2 - Support Scope": "# A.2..." }
```

### API Endpoint

```bash
# GET /api/atlas.md - Returns complete Atlas as markdown
curl https://your-domain.com/api/atlas.md > atlas.md
```

### Output Format

The exporter generates valid Atlas Markdown with:

- Proper heading levels (capped at 6)
- Document numbers, names, types, and UUIDs
- Content sections
- Extra fields for specific document types
- Correct hierarchical nesting

## Importing from Markdown

### Programmatic Import

```typescript
import { parseAtlasMarkdown } from '@/app/server/atlas/export/atlas-markdown-importer';

const markdown = `
# A.1 - Test Scope [Scope]  <!-- UUID: abc-123 -->

Content here.
`;

const trees = parseAtlasMarkdown(markdown);
// Returns: ExportAtlasTreeScopeTrees (structured JSON tree)
```

### How Import Works

1. **Parse line-by-line**: Identifies title lines and content
2. **Calculate parent**: Uses document numbers to find parent documents
3. **Build tree**: Constructs hierarchical JSON structure
4. **Extract fields**: Parses extra fields for specific document types
5. **Return JSON**: Returns standardized Atlas JSON format

### Parent-Child Resolution

The importer uses document numbers (not heading levels) to determine relationships:

```markdown
##### A.1.2.3.4.5 - Parent [Core]

###### A.1.2.3.4.5.6 - Child [Core]

###### A.1.2.3.4.5.7 - Sibling [Core]
```

Even though all three use 5-6 hashtags, document numbers reveal:

- `A.1.2.3.4.5.6` is child of `A.1.2.3.4.5`
- `A.1.2.3.4.5.7` is sibling of `A.1.2.3.4.5.6`

## Atlas Markdown File Validation

### Command-Line Validator

Validate Atlas markdown file:

```bash
# Validate a markdown file
npx tsx scripts/validate-atlas-markdown.ts path/to/atlas.md
```

### Validations Performed

1. **Title line format**: `# {DocNo} - {Name} [{Type}]  <!-- UUID: {uuid} -->`
2. **Heading level cap**: Maximum 6 hashtags
3. **Heading level correctness**: Matches document number depth
4. **Document numbering**: Valid patterns for each document type
5. **Parent-child relationships**: Valid nesting based on document numbers
6. **Extra fields**: Correct format and order for document types
7. **UUIDs**: Valid format and uniqueness
8. **Blank lines**: Proper spacing

### Exit Codes

- `0`: Validation passed (warnings OK)
- `1`: Errors found

## Round-Trip Guarantees

The system maintains data fidelity through export-import cycles:

```typescript
// 1. Export from JSON
const originalJSON = await buildExportAtlasTreeJSON();
const markdown = await buildAtlasMarkdown();

// 2. Import back to JSON
const reimportedTrees = parseAtlasMarkdown(markdown);

// Result: reimportedTrees should match originalJSON structure
```

### Preserved Data

- Document hierarchy and relationships
- Document numbers, names, types, UUIDs
- Content (with whitespace normalization)
- Extra fields for Type Specifications, Scenarios, etc.
- All child collection structures

### Normalization

Some normalization occurs during round-trip:

- Leading/trailing blank lines in content are trimmed
- Internal blank lines are preserved
- Extra field values are trimmed

## Special Use Cases

### Split by Scope

```typescript
// Export separate files per scope
const markdownsByScope = await buildAtlasMarkdownsPerScope();

// Write to individual files
for (const [scopeName, content] of Object.entries(markdownsByScope)) {
  await fs.writeFile(`atlas-${scopeName}.md`, content);
}
```

## Limitations

1. **Heading level cap**: Documents at depth > 6 all use 6 hashtags
   - **Mitigation**: Document numbers preserve full hierarchy

2. **Manual editing risks**: Editing markdown can introduce errors
   - **Mitigation**: Use validator before importing

3. **UUID preservation**: UUIDs must not be changed
   - **Mitigation**: Validator warns about changes

4. **Whitespace normalization**: Some formatting changes may occur
   - **Mitigation**: Internal blank lines are preserved

## Notes

### Heading Level Cap

Markdown viewers don't support more than 6 heading levels. The system:

- **Caps heading levels at 6 hashtags** (######)
- Uses **document numbers** (not heading levels) to determine hierarchy
- Maintains full hierarchical fidelity for any depth

Example:

```markdown
###### A.1.2.3.4.5.6 - Document at depth 6

###### A.1.2.3.4.5.6.7 - Document at depth 7 (capped at 6 hashtags)

###### A.1.2.3.4.5.6.7.8 - Document at depth 8 (capped at 6 hashtags)
```

### Semantic Depth Calculation

The system calculates true hierarchical depth from document numbers:

- **Regular documents**: Count segments (e.g., `A.1.2.3` = depth 3)
- **Supporting documents**: Use special patterns (e.g., `.0.3.X` for Annotations)
- **Needed Research**: Context-dependent (uses parent in tree)

## See Also

- [Atlas Markdown Syntax](./ATLAS_MARKDOWN_SYNTAX.md) - Complete syntax reference
- [Atlas Document Numbering Rules](./ATLAS_DOCUMENT_NUMBERING_RULES.md) - Document numbering system
- [Atlas Extra Fields](./ATLAS_EXTRA_FIELDS.md) - Extra fields for specific document types
