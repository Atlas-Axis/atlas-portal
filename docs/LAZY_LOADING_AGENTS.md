# Lazy Loading Agent Scope Database to Reduce ISR Size

## Problem

Both `/atlas` and `/atlas/list` pages exceeded Vercel's 19.07 MB ISR size limit (initially 25.42 MB, then 29 MB even with client-side hydration) when including the Agent Scope Database during static generation, causing `FALLBACK_BODY_TOO_LARGE` build failures.

## Solution

Embed Agent Scope Database data as **compact `StandardizedAtlasDocument` JSON** (using Markdown instead of verbose Rich Text) in the HTML and hydrate it client-side, avoiding both ISR bloat and separate API calls.

### Architecture Flow

1. **Server (ISR)**: Load all Atlas data including agents as `AtlasTreeNode[]`
2. **Server (ISR)**: Convert the ENTIRE scope trees to `StandardizedAtlasDocument[]` (Markdown) with `omitAgents: true` to exclude agent subtrees from the initial render
3. **Server (ISR)**: Convert agent root nodes to `StandardizedAtlasDocument[]` (tree-shaped, not flattened for `/atlas`)
4. **Server (ISR)**: Embed agent data and UUID mappings as JSON in `<script>` tags
5. **Server (ISR)**: Render initial HTML without agent content (placeholder shown at the Agent Root Section)
6. **Client**: Read embedded JSON, deserialize UUID mappings, and pass agent docs to the renderer for surgical insertion

---

## Implementation Overview

### `/atlas/list` Page (Flat List View)

**Files:**

- `app/atlas/list/page.tsx` - Server component, loads all data including agents
- `app/atlas/list/atlas-list-prerendered.tsx` - Client wrapper, embeds agent JSON, manages state
- `app/atlas/list/agents-list-hydrator.tsx` - Reads JSON, updates state with agents

**Data Format:** `StandardizedAtlasDocument[]` (flattened)
**Merge Strategy:** Simple array append to state dictionary

### `/atlas` Page (Hierarchical Tree View)

**Files:**

- `app/atlas/page.tsx` - Server component, converts ENTIRE scope trees to `StandardizedAtlasDocument[]` (agents omitted), converts agent trees separately
- `app/atlas/atlas-page-prerendered.tsx` - Client wrapper, embeds agent JSON and UUID mappings, passes standardized scope trees
- `app/atlas/agents-hydrator.tsx` - Reads JSON and passes agent docs (no tree rebuilding)
- `app/atlas/content-tree.tsx` - Renders `StandardizedAtlasDocument` trees; shows placeholder while loading agents; surgically inserts agent docs at the Agent Root Section

**Data Format:** `StandardizedAtlasDocument[]` (tree structure for both scope trees and agent trees)
**Merge Strategy:** Surgical insertion under the Agent Root Section; no tree rebuilding

### Data Embedding

Both pages embed agent data as JSON using:

```tsx
<script
  id="agent-data" // or "agent-list-data" for list view
  type="application/json"
  dangerouslySetInnerHTML={{ __html: JSON.stringify(standardizedAgentDocs) }}
/>
<script
  id="uuid-mappings-data"
  type="application/json"
  dangerouslySetInnerHTML={{ __html: JSON.stringify(serializedUuidMappings) }}
/>
```

Client components read this with:

```tsx
const agentScript = document.getElementById('agent-data');
const agentDocs: StandardizedAtlasDocument[] = JSON.parse(agentScript.textContent);

const uuidMappingsScript = document.getElementById('uuid-mappings-data');
const serializedMappings = JSON.parse(uuidMappingsScript.textContent);
const uuidMappings = deserializeUuidMappings(serializedMappings);
```

Note: React list keys prefer Notion page IDs derived from UUID mappings when available; otherwise Atlas UUIDs are used as fallback.

---

## Key Differences

| Aspect              | `/atlas/list`                               | `/atlas`                                                |
| ------------------- | ------------------------------------------- | ------------------------------------------------------- |
| **Data Structure**  | Flat list per database                      | Hierarchical tree                                       |
| **Loader Function** | `loadAtlasFromSupabase...WithoutNesting...` | `loadAtlasFromSupabase...WithNestingAgentsUnderSection` |
| **Merge Strategy**  | Simple array append                         | Surgical insertion under Agent Root Section             |
| **Nesting Logic**   | Not needed                                  | Agents nested under specific section                    |
| **Loading UI**      | Fixed bottom-right indicator                | Placeholder in tree + bottom-right indicator            |
| **JSON Script ID**  | `agent-list-data`                           | `agent-data`                                            |

---

## Performance

### Benefits

- **ISR size reduced**: Agent data embedded as compact `StandardizedAtlasDocument` JSON with markdown (10x smaller than Rich Text)
- **Progressive enhancement**: Initial page renders immediately, agents load client-side
- **No API calls**: Eliminates network dependency and latency
- **Faster perceived load**: Immediate initial page render with progressive enhancement
- **Better reliability**: All data arrives with initial HTML
- **Easier debugging**: Agent data visible in HTML source
- **Cleaner architecture**: Single document format (`StandardizedAtlasDocument`) for JSON export

### Trade-offs

- Client-side JSON parsing
- Brief placeholder display before agents render
- Slightly larger initial HTML payload (but much smaller than pre-rendered agent HTML)

---

## Technical Details

### Placeholder Rendering (`/atlas` only)

The `ContentTree` component accepts an `agentsLoading` prop. When true, it renders a placeholder instead of agent nodes:

```tsx
{
  shouldShowAgentPlaceholder && (
    <div id="agent-section-placeholder" className="...">
      Loading agents...
    </div>
  );
}
```

The placeholder is shown for the section node with `notion_page_id === AGENT_ROOT_SECTION_UUID_FOR_NESTING`.

### Hydration Process

1. **Convert**: Server converts ENTIRE scope trees to `StandardizedAtlasDocument[]` with `omitAgents: true`; converts agent roots to `StandardizedAtlasDocument[]`
2. **Flatten** (list view only): Server flattens agent trees to flat arrays per database
3. **Embed**: Server embeds agents and UUID mappings as JSON in script tags
4. **Mount**: Client hydrator component mounts
5. **Read**: Hydrator reads JSON from DOM
6. **Parse**: JSON parsed into `StandardizedAtlasDocument[]`
7. **Deserialize**: UUID mappings deserialized from JSON
8. **Update**: Agents passed to renderer for surgical insertion (no tree rebuilding)

---

## Future Optimizations

- React Server Components streaming - Progressive rendering without client-side hydration
- Incremental/batch loading for very large agent datasets
- Service worker caching for repeat visits
- Virtual scrolling for large lists
- Compression of embedded JSON (e.g., using LZ-string)
