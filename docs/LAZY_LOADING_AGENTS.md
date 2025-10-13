# Lazy Loading Agent Scope Database to Reduce ISR Size

## Problem

Both `/atlas` and `/atlas/list` pages exceeded Vercel's 19.07 MB ISR size limit (25.42 MB actual) when including the Agent Scope Database during static generation, causing `FALLBACK_BODY_TOO_LARGE` build failures.

## Solution

Embed Agent Scope Database data as JSON in the HTML and hydrate it client-side, avoiding both ISR bloat and separate API calls.

### Architecture Flow

1. **Server (ISR)**: Load all Atlas data including agents
2. **Server (ISR)**: Extract agent nodes and embed as JSON in `<script>` tag
3. **Server (ISR)**: Render initial HTML without agent content (placeholder shown)
4. **Client**: Read embedded JSON and hydrate agents into the page

---

## Implementation Overview

### `/atlas/list` Page (Flat List View)

**Files:**

- `app/atlas/list/page.tsx` - Server component, loads all data including agents
- `app/atlas/list/atlas-list-prerendered.tsx` - Client wrapper, embeds agent JSON, manages state
- `app/atlas/list/agents-list-hydrator.tsx` - Reads JSON, updates state with agents

**Merge Strategy:** Simple array append to state dictionary

### `/atlas` Page (Hierarchical Tree View)

**Files:**

- `app/atlas/page.tsx` - Server component, loads all data including agents
- `app/atlas/atlas-page-prerendered.tsx` - Client wrapper, embeds agent JSON, manages tree state
- `app/atlas/agents-hydrator.tsx` - Reads JSON, rebuilds entire tree with agents
- `app/atlas/content-tree.tsx` - Shows placeholder for agents while loading

**Merge Strategy:** Flatten initial tree → add agents → rebuild complete tree

### Data Embedding

Both pages embed agent data as JSON using:

```tsx
<script
  id="agent-data" // or "agent-list-data" for list view
  type="application/json"
  dangerouslySetInnerHTML={{ __html: JSON.stringify(agentNodes) }}
/>
```

Client components read this with:

```tsx
const script = document.getElementById('agent-data');
const agentNodes = JSON.parse(script.textContent);
```

---

## Key Differences

| Aspect              | `/atlas/list`                               | `/atlas`                                                |
| ------------------- | ------------------------------------------- | ------------------------------------------------------- |
| **Data Structure**  | Flat list per database                      | Hierarchical tree                                       |
| **Loader Function** | `loadAtlasFromSupabase...WithoutNesting...` | `loadAtlasFromSupabase...WithNestingAgentsUnderSection` |
| **Merge Strategy**  | Simple array append                         | Full tree rebuild with flattening                       |
| **Nesting Logic**   | Not needed                                  | Agents nested under specific section                    |
| **Loading UI**      | Fixed bottom-right indicator                | Placeholder in tree + bottom-right indicator            |
| **JSON Script ID**  | `agent-list-data`                           | `agent-data`                                            |

---

## Performance

### Benefits

- **ISR size reduced**: Agent data embedded as compact JSON, not rendered HTML
- Progressive enhancement
- **No API calls**: Eliminates network dependency and latency
- **Faster perceived load**: Immediate initial page render with progressive enhancement
- **Better reliability**: All data arrives with initial HTML
- **Easier debugging**: Agent data visible in HTML source

### Trade-offs

- Client-side JSON parsing
- Client-side tree rebuilding for `/atlas`
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

1. **Extract**: Server flattens tree to extract agent nodes
2. **Embed**: Server embeds agents as JSON in script tag
3. **Mount**: Client hydrator component mounts
4. **Read**: Hydrator reads JSON from DOM
5. **Parse**: JSON parsed into `AtlasTreeNode[]`
6. **Rebuild**: Tree rebuilt with agents included
7. **Update**: State updated, triggering re-render with agents

---

## Future Optimizations

- React Server Components streaming - Progressive rendering without client-side hydration
- Incremental/batch loading for very large agent datasets
- Service worker caching for repeat visits
- Virtual scrolling for large lists
- Compression of embedded JSON (e.g., using LZ-string)
