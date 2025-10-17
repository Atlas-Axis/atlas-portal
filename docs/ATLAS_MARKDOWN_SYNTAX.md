# Atlas Markdown Syntax Documentation

## 1. Introduction

### Purpose

The Atlas Markdown format is a structured, human-readable representation of the entire Atlas document hierarchy. It serves as:

- A portable, version-controllable format for the Atlas
- An interchange format for importing and exporting Atlas data
- A human-editable format for making changes to Atlas documents

### Critical Importance

**⚠️ WARNING**: The Atlas Markdown parser expects exact adherence to the syntax rules documented here. Deviations from these rules will cause the parser to fail or produce incorrect results. Always validate your changes before importing.

## 2. File Structure & Hierarchy

The Atlas Markdown file represents the document hierarchy using standard Markdown heading levels. The heading level directly corresponds to the depth of the document in the Atlas tree.

**Hierarchy Representation:**

- `#` (Heading 1) = Scope documents (top level)
- `##` (Heading 2) = Article documents (under Scopes)
- `###` (Heading 3) = Section documents (under Articles)
- `####` (Heading 4) = Primary documents (Core, Type Specification, Active Data Controller) under Sections
- `#####` (Heading 5) = Nested primary documents or supporting documents
- And so on...

**Example Hierarchy:**

```markdown
# A.1 - The Governance Scope [Scope] <!-- UUID: abc-123 -->

Scope content here.

## A.1.1 - Governance Framework [Article] <!-- UUID: def-456 -->

Article content here.

### A.1.1.1 - Decision Making [Section] <!-- UUID: ghi-789 -->

Section content here.

#### A.1.1.1.1 - Voting Process [Core] <!-- UUID: jkl-012 -->

Core document content here.

##### A.1.1.1.1.1 - Vote Counting [Core] <!-- UUID: mno-345 -->

Nested core document content here.
```

## 3. Title Line Syntax

Every document in the Atlas Markdown file begins with a title line that follows this exact pattern:

### Pattern

```
{Heading Level} {Doc Number} - {Name} [{Type}]  <!-- UUID: {uuid} -->
```

### Components

1. **Heading Level**: One or more `#` symbols (1-6) based on document depth
   - Must have exactly one space after the last `#`

2. **Document Number**: The formal Atlas document identifier
   - Examples: `A.1`, `A.1.2.3`, `A.1.1.0.3.1`, `NR-5`
   - Must follow Atlas numbering rules (see Section 6)

3. **Separator**: Space, hyphen, space: `-`
   - Must be exactly this format (not just `-` or ` -` or `- `)

4. **Document Name**: The human-readable name of the document
   - Can contain any characters except `[` and `]`

5. **Document Type**: Enclosed in square brackets with space before
   - Format: ` [{Type}]`
   - Must be one space before opening bracket
   - Must be a valid Atlas document type (see list below)

6. **UUID Comment**: HTML comment with exactly two spaces before it
   - Format: `  <!-- UUID: {uuid} -->`
   - Must have exactly two spaces before `<!--`
   - UUID can be any valid UUID format (e.g., `8650a584-01f8-45d6-882b-c14eab9879c4`)
   - Must be unique within the file and cannot be empty
   - **For new documents**: Generate a new UUID using any online UUID generator (UUID v4 recommended)
   - **For existing documents**: ⚠️ **Never change existing UUIDs** - they are permanent identifiers used by automations to track documents across changes. Changing a UUID will break document matching and cause data integrity issues

### Valid Document Types

- Scope
- Article
- Section
- Core
- Type Specification
- Active Data Controller
- Annotation
- Action Tenet
- Scenario
- Scenario Variation
- Active Data
- Needed Research

### Examples

```markdown
# A.0 - Atlas Preamble [Scope] <!-- UUID: 8650a584-01f8-45d6-882b-c14eab9879c4 -->

## A.1.2 - Support Scope Activities [Article] <!-- UUID: 56b15d7d-cdd4-4594-bd95-4f094564ac04 -->

### A.1.2.3 - Resource Allocation [Section] <!-- UUID: c7d62f28-1d64-4632-8cd8-4f2b44c51bba -->

#### A.1.2.3.1 - Budget Process [Core] <!-- UUID: 4f6fda1e-7450-4065-8095-e93cb10b3a2a -->

##### A.1.2.3.1.0.3.1 - Budget - Element Annotation [Annotation] <!-- UUID: 5e2e1397-ff87-43ce-a742-e5a68dc89a44 -->
```

## 4. Content Separation

Documents consist of a title line followed by content, with specific spacing rules:

### Standard Document Structure

```markdown
#### A.1.1.1.1 - Document Title [Core] <!-- UUID: abc-123 -->

This is the first paragraph of content.

This is the second paragraph. Note the blank lines are preserved between paragraphs.

#### A.1.1.1.2 - Next Document [Core] <!-- UUID: def-456 -->
```

### Spacing Rules

1. **After Title Line**: Exactly one blank line before content begins
2. **Between Paragraphs**: Blank lines within content are preserved
3. **Before Next Document**: Exactly one blank line before the next title line
4. **Before Extra Fields**: Exactly one blank line before the first extra field (if any)

### Note: Multi-Line Inline Code Syntax in Markdown

Inline code (backticks) can span multiple lines:

```markdown
#### A.1.1.1.1 - Code Example [Core] <!-- UUID: abc-123 -->

The function signature is `function calculate(
  value: number,
  options: Options
): Result` and it returns the computed result.
```

**Note**: For multi-line code, prefer using code blocks instead of inline code for better readability:

````markdown
#### A.1.1.1.1 - Code Example [Core] <!-- UUID: abc-123 -->

The function signature is:

```
function calculate(value: number, options: Options): Result {
  return computeResult(value, options);
}
```

This approach provides better formatting.
````

### Content vs Extra Fields

- Everything from the blank line after the title up to the first `**Label**:` pattern is considered the document's main content
- If no extra fields exist, all text until the next title line is content

## 5. Extra Fields Syntax

Certain document types have structured extra fields that appear after the main content. These fields use a specific format that must be followed exactly.

### Format

```markdown
#### A.1.2.2.2.1 - The Type Specification Type [Type Specification] <!-- UUID: abc-123 -->

Main content goes here.

**Components**:

Value for components field. This can span
multiple lines and preserve formatting.

**Doc Identifier Rules**:

Value for doc identifier rules.

**Type Category**:

Primary Document
```

### Syntax Rules

1. **Label Line**:
   - Format: `**{Label}**:`
   - Bold label (double asterisks) followed immediately by colon
   - **No value on the same line as the label**
   - Labels are case-sensitive and must match exactly

2. **Blank Line After Label**:
   - Exactly one blank line after the label line

3. **Field Value**:
   - Can span multiple lines
   - Preserves internal formatting and blank lines
   - Leading and trailing blank lines are automatically trimmed by the parser

4. **Blank Line After Value**:
   - Exactly one blank line after the value

### Documents with Extra Fields

#### Type Specification (6 fields)

Must appear in this order:

1. **Components**
2. **Doc Identifier Rules**
3. **Additional Logic**
4. **Type Category**
5. **Type Name**
6. **Type Overview**

**Example:**

```markdown
##### A.1.2.2.2.1 - The Type Specification Type [Type Specification] <!-- UUID: 468d192b-83bc-45ab-896f-53e8ca307135 -->

[See below]

**Components**:

"Type Name": The Type Name Component must contain the name of the Document Type

"Type Overview": The Type Overview Component must contain high level information as human-readable text about the type, such as what it is used for and why it is necessary.

**Doc Identifier Rules**:

Type Specification Documents must follow the Document Identifier rules for Primary Documents.

**Additional Logic**:

The rules specified in Type Specification Documents must be followed for all Atlas Documents.

**Type Category**:

Primary Document

**Type Name**:

Type Specification

**Type Overview**:

The Type Specification Type is used for Type Specification Documents that specify the characteristics of each of the different Document Types.
```

#### Scenario (3 fields)

Must appear in this order:

1. **Description**
2. **Finding**
3. **Additional Guidance**

#### Scenario Variation (3 fields)

Must appear in this order:

1. **Description**
2. **Finding**
3. **Additional Guidance**

#### Needed Research (1 field)

1. **Content**

### Important Notes

- Extra fields must appear in the exact order specified for each document type
- All fields must be present, even if empty (empty fields have no value between the blank lines)
- Field labels are case-sensitive and must match exactly
- The parser detects extra fields by the `**Label**:` pattern (bold text ending with colon)

## 6. Document Numbering Rules

Atlas document numbers follow a hierarchical system. This section provides a summary

### Basic Patterns by Document Type

| Document Type          | Pattern                            | Example                   |
| ---------------------- | ---------------------------------- | ------------------------- |
| Scope                  | `A.{N}`                            | `A.0`, `A.1`, `A.2`       |
| Article                | `{Scope}.{N}`                      | `A.1.1`, `A.1.2`, `A.2.1` |
| Section                | `{Article}.{N}` or `{Section}.{N}` | `A.1.1.1`, `A.1.1.2`      |
| Core                   | `{Section}.{N}`                    | `A.1.1.1.1`, `A.1.1.1.2`  |
| Type Specification     | `{Section}.{N}`                    | `A.1.2.2.2.1`             |
| Active Data Controller | `{Section}.{N}`                    | `A.1.1.3.1`               |
| Annotation             | `{Target}.0.3.{N}`                 | `A.1.12.1.2.0.3.1`        |
| Action Tenet           | `{Target}.0.4.{N}`                 | `A.1.4.5.0.4.1`           |
| Scenario               | `{Tenet}.1.{N}`                    | `A.1.4.5.0.4.1.1.1`       |
| Scenario Variation     | `{Scenario}.var{N}`                | `A.1.4.5.0.4.1.1.1.var1`  |
| Active Data            | `{Controller}.0.6.{N}`             | `A.1.1.3.1.0.6.1`         |
| Needed Research        | `NR-{N}`                           | `NR-1`, `NR-5`, `NR-10`   |

### Key Principles

1. **Hierarchical Inheritance**: Most documents inherit their parent's full number and append their own segment

2. **Sequential Numbering**: Sibling documents are numbered sequentially starting from 1 (except Scope documents which start from 0, and Needed Research which uses global numbering)

3. **Special Directory Numbers**: Supporting documents use special numbers:
   - `.0` = Supporting Root directory
   - `.0.3` = Element Annotation Directory
   - `.0.4` = Facilitator Tenet Annotation Directory
   - `.0.6` = Active Data Directory
   - `.1` = Facilitator Scenario Directory

4. **Mixed Document Types**: When multiple document types exist as siblings under the same parent (in `Sections & Primary Docs` or `Agent Scope Database`), they use **sequential numbering across all document types**, not per-type numbering.

   **Example**: If a section has 1 Core, 1 Active Data Controller, and 1 Type Specification, they are numbered:
   - `A.1.1.1` (Core)
   - `A.1.1.2` (Active Data Controller)
   - `A.1.1.3` (Type Specification)

   As opposed to all numbered `.1` which would create duplicates.

### Nesting Capabilities

- **Core documents** can nest under other Core documents (arbitrary depth)

## 7. Nesting Rules & Restrictions

Understanding what documents can be nested under other documents is critical for maintaining valid Atlas structure.

### Allowed Nesting Hierarchy

```
Scope
└── Article
    └── Section
        ├── Core (can nest: Core → Core → Core)
        │   ├── Annotation (.0.3.X)
        │   └── Tenet (.0.4.X)
        │       └── Scenario (.1.X)
        │           └── Scenario Variation (.varX)
        ├── Active Data Controller
        │   ├── Active Data (.0.6.X)
        │   ├── Annotation (.0.3.X)
        │   └── Tenet (.0.4.X)
        ├── Type Specification
        │   ├── Annotation (.0.3.X)
        │   └── Tenet (.0.4.X)
        ├── Annotation (.0.3.X)
        └── Tenet (.0.4.X)
            └── Scenario (.1.X)
                └── Scenario Variation (.varX)
```

### Needed Research Exception

Needed Research documents can be nested under **any** document type in the Atlas. They use global numbering (`NR-1`, `NR-2`, etc.) regardless of their parent.

### Validation

When editing the Atlas Markdown:

1. Verify parent-child relationships follow the allowed hierarchy
2. Ensure document numbers reflect the correct parent (inherit parent's number)
3. Check that heading levels match the nesting depth
4. Confirm supporting documents use correct directory numbers (`.0.3`, `.0.4`, etc.)

## 8. Validation & Common Errors

### Validation Tool

The project includes a command-line validator script that can check Atlas Markdown files for syntax errors and structural issues:

```bash
npx tsx scripts/validate-atlas-markdown.ts [file-path]
```

**Examples:**

```bash
# Validate the default Atlas markdown file
npx tsx scripts/validate-atlas-markdown.ts

# Validate a specific file
npx tsx scripts/validate-atlas-markdown.ts atlas.md
```

The validator checks for:

- Proper title line format (heading, document number, name, type, UUID)
- Correct heading level progression (no skipped levels)
- Valid document numbering according to Atlas rules
- Proper extra fields format and ordering for document types that require them
- UUID uniqueness and format
- Correct parent-child relationships based on document types
- Proper spacing around content and extra fields

**Using the validator is highly recommended** before importing Atlas Markdown files to catch syntax errors early.

### Critical Syntax Rules

To ensure the parser can correctly process the Atlas Markdown file, follow these rules:

1. **Title Line Format**:
   - Must exactly match: `{Heading} {DocNo} - {Name} [{Type}]  <!-- UUID: {uuid} -->`
   - Exactly two spaces before the UUID comment
   - One space after heading symbols
   - One space before opening bracket of type

2. **Heading Consistency**:
   - Cannot skip heading levels (e.g., cannot go from `##` to `####`)
   - Each child must be exactly one level deeper than its parent

3. **Document Numbers**:
   - Must follow the numbering rules for the document type
   - Siblings must be numbered sequentially without gaps (e.g., 1, 2, 3, not 1, 3, 5)
   - Exception: Special directory numbers (`.0.3`, `.0.6`, etc.) and Needed Research (`NR-X`)

4. **Extra Field Labels**:
   - Must match exactly (case-sensitive)
   - Must appear in the correct order for the document type
   - Label line must end with colon and have no value on the same line

5. **Blank Lines**:
   - Required after title line
   - Required around extra field labels and values
   - Extra fields need blank line after value (except last field)

### Parser Behavior

Understanding how the parser works helps avoid errors:

- **Automatic Trimming**: Leading and trailing blank lines are automatically removed from field values and content
- **Internal Preservation**: Blank lines within content and field values are preserved
- **Field Detection**: The parser identifies extra fields by the `**Label**:` pattern
- **Content Boundary**: Everything before the first `**Label**:` line is considered main content

## 9. Complete Examples

### Example 1: Simple Core Document

```markdown
#### A.0.1.1.1 - Organizational Alignment [Core] <!-- UUID: 4f6fda1e-7450-4065-8095-e93cb10b3a2a -->

Organizational alignment is a traditional business concept and can be described as the process of implementing strategies and philosophies to ensure that each member of an organization, from entry-level positions to executive managers, shares a common goal and vision for the success of an organization.
```

### Example 2: Type Specification with All Extra Fields

```markdown
##### A.1.2.2.2.1 - The Type Specification Type [Type Specification] <!-- UUID: 468d192b-83bc-45ab-896f-53e8ca307135 -->

[See below]

**Components**:

"Type Name": The Type Name Component must contain the name of the Document Type

"Type Overview": The Type Overview Component must contain high level information as human-readable text about the type, such as what it is used for and why it is necessary.

"Type Components": If the Type has Components, they must be specified in this Component as a nested object.

**Doc Identifier Rules**:

Type Specification Documents must follow the Document Identifier rules for Primary Documents.

**Additional Logic**:

The rules specified in Type Specification Documents must be followed for all Atlas Documents.

**Type Category**:

Primary Document

**Type Name**:

Type Specification

**Type Overview**:

The Type Specification Type is used for Type Specification Documents that specify the characteristics of each of the different Document Types. It ensures that all Type Specifications contain all necessary information to make it easy to reason about whether a document follows the requirements for its type.
```

### Example 3: Nested Core Documents

```markdown
### A.1.1.1 - Definitions [Section] <!-- UUID: c7d62f28-1d64-4632-8cd8-4f2b44c51bba -->

This Section contains essential definitions.

#### A.1.1.1.1 - Universal Alignment [Core] <!-- UUID: 9f953b73-566e-4428-a9d2-e179513c3371 -->

Universal Alignment refers to an actor's holistic understanding of their connection to their environment or context.

##### A.1.1.1.1.1 - Alignment in Practice [Core] <!-- UUID: 2ea378ee-9b12-4e09-9f42-0c6ec65ef33b -->

This nested core document provides practical guidance on applying Universal Alignment principles.
```

### Example 4: Supporting Documents (Tenet → Scenario → Variation)

```markdown
#### A.1.2.2.1.4 - Accessory Document Category [Core] <!-- UUID: dfb4784c-2d53-4643-ae0f-debab9dd5aec -->

Accessory Documents provide accessory data to every other Atlas Document type.

##### A.1.2.2.1.4.0.4.1 - Determine Modification Process [Action Tenet] <!-- UUID: c3f58d8c-f734-4b5b-a2c9-261c7eb02d97 -->

Currently, in the transition to Endgame, the Immutable Documents can be amended pursuant to specific rules.

###### A.1.2.2.1.4.0.4.1.1.1 - Amendment Scenario [Scenario] <!-- UUID: abc-def-123 -->

This scenario describes the process.

**Description**:

A detailed description of the amendment scenario.

**Finding**:

The key finding from this scenario analysis.

**Additional Guidance**:

Facilitators should consider these factors.

####### A.1.2.2.1.4.0.4.1.1.1.var1 - Emergency Amendment [Scenario Variation] <!-- UUID: ghi-jkl-456 -->

This variation covers emergency amendments.

**Description**:

Description of the emergency variation.

**Finding**:

Finding specific to emergency cases.

**Additional Guidance**:

Additional guidance for emergency situations.
```

### Example 5: Global Needed Research

```markdown
#### A.1.1.1.1 - Universal Alignment [Core] <!-- UUID: 9f953b73-566e-4428-a9d2-e179513c3371 -->

Universal Alignment refers to an actor's holistic understanding.

##### NR-15 - Research Universal Alignment Metrics [Needed Research] <!-- UUID: 123-456-789 -->

**Content**:

Further research is needed to develop quantitative metrics for measuring Universal Alignment in practice. This research should explore both subjective and objective indicators.
```

## 11. UUIDs

When editing the Atlas Markdown file:

1. **Generate UUIDs for New Documents**: Use an online UUID generator (e.g., [uuidgenerator.net](https://www.uuidgenerator.net/)) for any newly added documents
2. **Never Modify Existing UUIDs**: UUIDs are permanent identifiers - changing them breaks document tracking across versions in external automations
