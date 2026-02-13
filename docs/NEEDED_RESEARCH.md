#### Needed Research Positioning in Markdown

> **⚠️ IMPORTANT: Needed Research Must Appear First Among All Children**
>
> In markdown, Needed Research documents must appear **first** among all children of their parent document - before any other siblings, including both primary documents (Core, Section, etc.) and other supporting documents (Annotations, Tenets, etc.).

**Why This Rule Exists**:

Since NR documents use global numbering (`NR-1`, `NR-2`, etc.) that doesn't encode their parent, the Markdown importer cannot determine the parent from the document number alone. The importer uses a **stack-based parser** where each document is pushed onto a stack as it's read, and NR documents attach to the nearest non-NR document on the stack.

By placing NR documents immediately after their parent (before any siblings), the parent is guaranteed to be on top of the stack when the NR document is parsed.

**Correct Order**:

```markdown
## A.1.2 - Some Section [Section]

### NR-5 - Research Topic [Needed Research] ← NR first, parent A.1.2 is on stack

### A.1.2.1 - Some Core Doc [Core]

### A.1.2.0.3.1 - Some Annotation [Annotation]
```

**Incorrect Order** (would cause the parser to detect the NR doc under the wrong parent):

```markdown
## A.1.2 - Some Section [Section]

### A.1.2.1 - Some Core Doc [Core]

### NR-5 - Research Topic [Needed Research] ← Wrong! A.1.2.1 is on stack, NR attaches to it
```
