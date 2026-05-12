import { markdownToHTML } from '@/app/server/markdown/markdown-to-html';
import type { DocChange } from '@/app/server/proposal/atom-tree-diff';
import { wordDiff } from '@/app/server/proposal/diff';
import type { ProposalData } from '@/app/server/proposal/load-proposal-data';

/**
 * Build the body string to feed into wordDiff for a given DocChange.
 * Adds the doc name as the first line so name-only changes are highlighted
 * the same way as body changes.
 */
function changeOldText(c: DocChange): string {
  if (c.kind === 'added') return '';
  const base = c.base!;
  return `${base.name}\n${base.contentLines.join('\n')}`;
}
function changeNewText(c: DocChange): string {
  if (c.kind === 'removed') return '';
  const head = c.current!;
  return `${head.name}\n${head.contentLines.join('\n')}`;
}

function changeTitle(c: DocChange): string {
  if (c.kind === 'added') {
    return `${c.current!.docNo} — ${c.current!.name}`;
  }
  if (c.kind === 'removed') {
    return `${c.base!.docNo} — ${c.base!.name}`;
  }
  // Modified — use the head metadata.
  return `${c.current!.docNo} — ${c.current!.name}`;
}

function changeBadge(c: DocChange): { label: string; cls: string } {
  if (c.kind === 'added') {
    return { label: 'Added', cls: 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-200' };
  }
  if (c.kind === 'removed') {
    return { label: 'Removed', cls: 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-200' };
  }
  return { label: 'Modified', cls: 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200' };
}

interface ProposalPagePrerenderedProps {
  data: ProposalData;
}

/**
 * Server-rendered proposal viewer. No client interactivity is needed for v1
 * (no expand/collapse, no search) so this stays a plain async server
 * component — no `'use client'` directive.
 */
export default function ProposalPagePrerendered({ data }: ProposalPagePrerenderedProps) {
  const { proposal, changes, summaryMarkdown, summarySource } = data;

  const summaryHtml = summaryMarkdown ? markdownToHTML(summaryMarkdown) : '';

  return (
    <div className="min-h-screen bg-white px-4 py-10 text-zinc-900 sm:px-8 dark:bg-zinc-900 dark:text-zinc-100">
      <div className="mx-auto max-w-4xl">
        <header className="mb-8 border-b border-zinc-200 pb-6 dark:border-zinc-700">
          <p className="mb-1 text-sm tracking-wide text-zinc-500 uppercase dark:text-zinc-400">
            Atlas Edit Proposal · PR #{proposal.prNumber}
          </p>
          <h1 className="text-3xl font-semibold">{proposal.title}</h1>
        </header>

        {summaryHtml ? (
          <section className="prose prose-zinc dark:prose-invert mb-12 max-w-none">
            <h2 className="text-xl font-semibold">Summary</h2>
            {summarySource === 'tree-file' && (
              <p className="text-sm text-zinc-500 dark:text-zinc-400">
                (Summary loaded from the proposal branch — PR body was empty.)
              </p>
            )}
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

        <section data-testid="proposal-diff">
          <h2 className="mb-6 text-xl font-semibold">Document Changes</h2>
          {changes.length === 0 ? (
            <p className="text-zinc-500 dark:text-zinc-400">No document changes detected.</p>
          ) : (
            <p className="mb-6 text-sm text-zinc-500 dark:text-zinc-400">
              {changes.length} document{changes.length === 1 ? '' : 's'} changed.
            </p>
          )}
          <div className="space-y-10">
            {changes.map((c, idx) => {
              const badge = changeBadge(c);
              const diffHtml = wordDiff(changeOldText(c), changeNewText(c));
              return (
                <article
                  key={idx}
                  data-testid="proposal-changed-doc"
                  data-doc-no={c.current?.docNo ?? c.base?.docNo}
                  className="rounded-lg border border-zinc-200 bg-zinc-50 px-5 py-4 dark:border-zinc-700 dark:bg-zinc-800/40"
                >
                  <header className="mb-3 flex items-center gap-3">
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${badge.cls}`}>{badge.label}</span>
                    <h3 className="text-base font-medium">{changeTitle(c)}</h3>
                  </header>
                  <div
                    className="proposal-doc-diff font-mono text-sm leading-6 break-words whitespace-pre-wrap"
                    dangerouslySetInnerHTML={{ __html: diffHtml }}
                  />
                </article>
              );
            })}
          </div>
        </section>
      </div>

      <style>{`
        .proposal-doc-diff .added {
          background-color: rgba(34, 197, 94, 0.18);
          color: #065f46;
          padding: 0 2px;
          border-radius: 2px;
        }
        .proposal-doc-diff .removed {
          background-color: rgba(239, 68, 68, 0.18);
          color: #7f1d1d;
          text-decoration: line-through;
          padding: 0 2px;
          border-radius: 2px;
        }
        :is(.dark) .proposal-doc-diff .added {
          color: #bbf7d0;
        }
        :is(.dark) .proposal-doc-diff .removed {
          color: #fecaca;
        }
      `}</style>
    </div>
  );
}
