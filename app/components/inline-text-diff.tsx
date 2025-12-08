'use client';

import { useMemo } from 'react';
import { diffWords } from 'diff';

/**
 * Renders an inline diff between two text strings.
 * The diff computation is memoized to avoid expensive recalculations on re-renders.
 */
export function InlineTextDiff({ newContent, oldContent }: { newContent: string; oldContent: string }) {
  const diffElements = useMemo(() => getInlineDiff(oldContent, newContent), [oldContent, newContent]);
  return <div className="text-sm">{diffElements}</div>;
}

function getInlineDiff(oldString: string, newString: string): React.ReactElement[] {
  const diff = diffWords(oldString, newString);

  return diff.map((part, index) => {
    if (part.added) {
      return (
        <span className="text-green-500" key={index}>
          {part.value}
        </span>
      );
    } else if (part.removed) {
      return (
        <span className="text-red-500 line-through" key={index}>
          {part.value}
        </span>
      );
    } else {
      return <span key={index}>{part.value}</span>;
    }
  });
}
