'use client';

import { useClipboard } from '@heroui/use-clipboard';
import { Link2 } from 'lucide-react';

/**
 * A button that copies text to the clipboard when clicked.
 * Shows a "COPIED!" message for 3 seconds after successful copy.
 */
export function CopyToClipboardButton({ text }: { text: string }) {
  const { copied, copy } = useClipboard({ timeout: 3000 });

  return (
    <div className="relative flex items-center gap-1">
      <span
        role="button"
        tabIndex={0}
        onClick={(e) => {
          // preventDefault stops the native <details> toggle
          e.preventDefault();
          e.stopPropagation();
          copy(text);
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            e.stopPropagation();
            copy(text);
          }
        }}
        className="inline-flex h-6 w-6 min-w-6 cursor-pointer items-center justify-center rounded-md hover:bg-gray-200 active:bg-gray-300"
        title="Copy link to clipboard"
      >
        <Link2 className="text-default-400" size={12} />
      </span>
      {copied && (
        <span className="absolute top-0 left-8 rounded-md bg-white px-2 py-1 text-xs font-semibold whitespace-nowrap text-green-600 shadow-md">
          COPIED!
        </span>
      )}
    </div>
  );
}
