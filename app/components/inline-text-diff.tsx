import { diffWords } from 'diff';

export function InlineTextDiff({ newContent, oldContent }: { newContent: string; oldContent: string }) {
  return <div className="text-sm">{getInlineDiff(oldContent, newContent)}</div>;
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
