import { markdownToHTML } from '@/app/server/markdown/markdown-to-html';
import {
  type ScopeBranch,
  buildHierarchicalBranches,
  renderBranchToHtml,
} from '@/app/server/proposal/hierarchical-tree';
import type { ProposalData } from '@/app/server/proposal/load-proposal-data';

interface ProposalPagePrerenderedProps {
  data: ProposalData;
}

/**
 * Server-rendered proposal viewer.
 *
 * Renders the proposal as a hierarchical doc-stream: one section per
 * independent change branch, each laying out the parent path → changed
 * descendants → deleted descendants nested under their original parent.
 * Word-level diff is highlighted inline within changed lines.
 *
 * No client-side scripting — the page is fully static at build time.
 */
export default function ProposalPagePrerendered({ data }: ProposalPagePrerenderedProps) {
  const { proposal, changes, baseDocs, headDocs, summaryMarkdown } = data;
  const summaryHtml = summaryMarkdown ? markdownToHTML(summaryMarkdown) : '';

  const branches: ScopeBranch[] = buildHierarchicalBranches(baseDocs, headDocs, changes);

  const totalChanged = changes.length;
  const added = changes.filter((c) => c.kind === 'added').length;
  const modified = changes.filter((c) => c.kind === 'modified').length;
  const removed = changes.filter((c) => c.kind === 'removed').length;

  return (
    <div className="min-h-screen bg-white px-4 py-10 text-zinc-900 sm:px-8 dark:bg-zinc-900 dark:text-zinc-100">
      <div className="mx-auto max-w-4xl">
        <header className="mb-8 border-b border-zinc-200 pb-6 dark:border-zinc-700">
          <p className="mb-1 text-sm tracking-wide text-zinc-500 uppercase dark:text-zinc-400">
            Atlas Edit Proposal · PR #{proposal.prNumber}
          </p>
          <h1 className="text-3xl font-semibold">{proposal.title}</h1>
          {totalChanged > 0 && (
            <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">
              {totalChanged} document{totalChanged === 1 ? '' : 's'} changed
              {(added > 0 || modified > 0 || removed > 0) && (
                <>
                  {' '}
                  <span className="text-zinc-400 dark:text-zinc-500">·</span>{' '}
                  {modified > 0 && (
                    <>
                      <span className="text-amber-700 dark:text-amber-300">{modified} edited</span>
                      {(added > 0 || removed > 0) && <>, </>}
                    </>
                  )}
                  {added > 0 && (
                    <>
                      <span className="text-emerald-700 dark:text-emerald-300">{added} new</span>
                      {removed > 0 && <>, </>}
                    </>
                  )}
                  {removed > 0 && <span className="text-rose-700 dark:text-rose-300">{removed} removed</span>}
                </>
              )}
            </p>
          )}
        </header>

        {summaryHtml ? (
          <section className="prose prose-zinc dark:prose-invert mb-12 max-w-none">
            <h2 className="text-xl font-semibold">Summary</h2>
            <div
              data-testid="proposal-summary"
              className="proposal-summary"
              dangerouslySetInnerHTML={{ __html: summaryHtml }}
            />
          </section>
        ) : (
          <section className="mb-12">
            <h2 className="text-xl font-semibold">Summary</h2>
            <p className="text-zinc-500 dark:text-zinc-400">No summary provided.</p>
          </section>
        )}

        <hr className="my-8 border-zinc-200 dark:border-zinc-700" />

        <section data-testid="proposal-diff" className="proposal-diff">
          <h2 className="mb-6 text-xl font-semibold">Document Changes</h2>
          {branches.length === 0 ? (
            <p className="text-zinc-500 dark:text-zinc-400">No document changes detected.</p>
          ) : (
            <div className="proposal-branches space-y-10">
              {branches.map((branch) => (
                <article
                  key={branch.slug}
                  id={branch.slug}
                  data-testid="proposal-branch"
                  data-branch-slug={branch.slug}
                  className="rounded-lg border border-zinc-200 bg-white px-5 py-4 dark:border-zinc-700 dark:bg-zinc-900/40"
                >
                  <header className="mb-4 border-b border-zinc-100 pb-3 dark:border-zinc-800">
                    <p className="text-[11px] font-semibold tracking-widest text-zinc-500 uppercase dark:text-zinc-400">
                      Edit branch
                    </p>
                    <h3 className="mt-1 text-lg font-semibold">
                      {branch.label}
                      {branch.labelDetail && (
                        <span className="ml-2 text-sm font-normal text-zinc-500 dark:text-zinc-400">
                          / {branch.labelDetail}
                        </span>
                      )}
                    </h3>
                    <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">{branch.summary}</p>
                  </header>
                  <div
                    className="proposal-doc-stream"
                    dangerouslySetInnerHTML={{ __html: renderBranchToHtml(branch) }}
                  />
                </article>
              ))}
            </div>
          )}
        </section>
      </div>

      <style>{proposalDiffCss}</style>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Scoped CSS for the hierarchical doc-stream.
// ---------------------------------------------------------------------------

const proposalDiffCss = `
  .proposal-doc-stream { font-size: 15px; line-height: 1.6; }

  .proposal-doc-stream .branch { position: relative; }
  .proposal-doc-stream .branch-children {
    margin-left: 16px;
    padding-left: 18px;
    border-left: 1px solid rgba(16, 24, 40, 0.10);
  }
  :is(.dark) .proposal-doc-stream .branch-children { border-left-color: rgba(255, 255, 255, 0.10); }

  .proposal-doc-stream .doc {
    position: relative;
    padding: 18px 0 14px;
    border-top: 1px solid rgba(16, 24, 40, 0.07);
  }
  .proposal-doc-stream .doc:first-child { border-top: 0; }
  .proposal-doc-stream .doc.compact { padding: 12px 0 10px; }
  :is(.dark) .proposal-doc-stream .doc { border-top-color: rgba(255, 255, 255, 0.07); }

  .proposal-doc-stream .doc-content { max-width: 920px; }
  .proposal-doc-stream .doc-head { margin-bottom: 6px; }
  .proposal-doc-stream .doc-meta {
    display: flex;
    align-items: center;
    gap: 10px;
    color: rgb(100, 116, 139);
    font-size: 10px;
    font-weight: 700;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    margin-bottom: 4px;
  }
  .proposal-doc-stream .doc-meta .status-edited { color: rgb(180, 83, 9); }
  .proposal-doc-stream .doc-meta .status-inserted { color: rgb(21, 128, 61); }
  .proposal-doc-stream .doc-meta .status-deleted { color: rgb(159, 18, 57); }
  :is(.dark) .proposal-doc-stream .doc-meta .status-edited { color: rgb(252, 211, 77); }
  :is(.dark) .proposal-doc-stream .doc-meta .status-inserted { color: rgb(134, 239, 172); }
  :is(.dark) .proposal-doc-stream .doc-meta .status-deleted { color: rgb(252, 165, 165); }

  .proposal-doc-stream .doc h3 {
    margin: 0;
    font-size: 17px;
    line-height: 1.2;
    font-weight: 600;
    letter-spacing: -0.01em;
  }
  .proposal-doc-stream .doc.compact h3 { font-size: 15px; font-weight: 600; color: rgb(82, 82, 91); }
  :is(.dark) .proposal-doc-stream .doc.compact h3 { color: rgb(161, 161, 170); }

  .proposal-doc-stream .doc-id {
    margin: 2px 0 0;
    color: rgb(113, 113, 122);
    font-size: 12px;
    font-family: ui-monospace, SFMono-Regular, "SF Mono", Menlo, monospace;
  }

  .proposal-doc-stream .doc-body {
    margin-top: 10px;
    max-width: 920px;
  }
  .proposal-doc-stream .doc-body p { margin: 0 0 10px; }
  .proposal-doc-stream .doc-body p:last-child { margin-bottom: 0; }
  .proposal-doc-stream .doc-body ul { margin: 0 0 10px; padding-left: 20px; list-style: disc; }
  .proposal-doc-stream .doc-body li { margin: 0 0 4px; }
  .proposal-doc-stream .doc-body code {
    font-family: ui-monospace, SFMono-Regular, "SF Mono", Menlo, monospace;
    font-size: 0.9em;
    padding: 1px 5px;
    border-radius: 4px;
    background: rgba(16, 24, 40, 0.06);
  }
  :is(.dark) .proposal-doc-stream .doc-body code { background: rgba(255, 255, 255, 0.08); }
  .proposal-doc-stream .doc-body a {
    color: rgb(37, 99, 235);
    text-decoration: underline;
  }
  :is(.dark) .proposal-doc-stream .doc-body a { color: rgb(96, 165, 250); }

  .proposal-doc-stream .diff-add, .proposal-doc-stream span.added {
    color: rgb(6, 95, 70);
    background-color: rgba(34, 197, 94, 0.18);
    border-radius: 3px;
    padding: 0 2px;
  }
  .proposal-doc-stream .diff-del, .proposal-doc-stream span.removed {
    color: rgb(127, 29, 29);
    background-color: rgba(239, 68, 68, 0.18);
    border-radius: 3px;
    padding: 0 2px;
    text-decoration: line-through;
  }
  :is(.dark) .proposal-doc-stream .diff-add, :is(.dark) .proposal-doc-stream span.added { color: rgb(187, 247, 208); }
  :is(.dark) .proposal-doc-stream .diff-del, :is(.dark) .proposal-doc-stream span.removed { color: rgb(254, 202, 202); }

  .proposal-doc-stream .collapsed-group {
    margin: 0 0 10px;
    color: rgb(113, 113, 122);
  }
  .proposal-doc-stream .collapsed-group p {
    margin: 0;
    font-size: 13px;
    font-style: italic;
  }
`;
