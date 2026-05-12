import Link from 'next/link';
import { ArrowRight } from 'lucide-react';

/**
 * Small callout linking to the /proposal route from /atlas.
 *
 * Rendered unconditionally — the /proposal page handles the "no current
 * proposal" case on its own (it shows a friendly empty state). Keeping
 * this unconditional means the /atlas page doesn't have to import the
 * proposal data loader and stays on its existing ISR cadence.
 *
 * Visually quiet: a thin top strip inside the atlas content area, easy
 * to skim past for return users but discoverable for newcomers.
 */
export default function ProposalCallout() {
  return (
    <div className="mb-4 sm:mb-6">
      <Link
        href="/proposal"
        className="group inline-flex items-center gap-2 rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 transition-colors hover:border-slate-300 hover:bg-slate-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-slate-300 dark:hover:border-zinc-600 dark:hover:bg-zinc-800"
      >
        <span className="font-medium text-slate-900 dark:text-slate-100">Atlas Edit Proposal</span>
        <span className="text-slate-500 dark:text-slate-400">— view the current diff</span>
        <ArrowRight
          size={14}
          aria-hidden
          className="text-slate-400 transition-transform group-hover:translate-x-0.5 dark:text-slate-500"
        />
      </Link>
    </div>
  );
}
