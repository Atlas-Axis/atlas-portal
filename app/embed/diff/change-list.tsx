import { InlineTextDiff } from '@/app/components/inline-text-diff';
import { NestedSubpageList } from '@/app/embed/diff/nested-subpages';
import { ProposalContext } from '@/app/server/atlas/proposal-generation/old/proposal-types';
import { TreeChange } from '@/app/server/diff/diff-trees';

interface ChangeListProps {
  changes: TreeChange[];
  context: ProposalContext;
}

export function ChangeList({ changes, context }: ChangeListProps) {
  if (changes.length === 0) {
    return (
      <div className="py-8 text-center">
        <div className="text-lg text-gray-500">No changes</div>
        <div className="mt-2 text-sm text-gray-400">The edited page is identical to the original.</div>
      </div>
    );
  }

  return (
    <div className="space-y-6 rounded-lg border border-gray-200 bg-white p-6">
      <div className="mb-4 text-sm text-gray-600">
        {changes.length} change{changes.length !== 1 ? 's' : ''}
      </div>

      {changes.map((change, index) => (
        <ChangeItem key={index} change={change} context={context} />
      ))}
    </div>
  );
}

interface ChangeItemProps {
  change: TreeChange;
  context: ProposalContext;
}

function ChangeItem({ change, context }: ChangeItemProps) {
  const { type, canonicalDocumentTitle } = change;

  // Format the action based on type
  const getActionText = () => {
    switch (type) {
      case 'added':
        return 'Add';
      case 'deleted':
        return 'Delete';
      case 'edited':
        return 'Replace';
      case 'moved':
        return 'Move';
      default:
        return 'Change';
    }
  };

  const renderContent = () => {
    switch (type) {
      case 'added':
        return (
          <div className="mt-3 rounded-lg border-l-4 border-gray-300 bg-gray-50 p-4">
            {/* Top-level content (can be truly blank) */}
            <div className="font-mono text-sm whitespace-pre-wrap text-gray-700">{change.content || ''}</div>
            {/* Nested subtree from duplicate side */}
            <div className="mt-3">
              <NestedSubpageList rootNode={change.node} context={context} side="duplicate" />
            </div>
          </div>
        );
      case 'deleted':
        return (
          <div className="mt-3 rounded-lg border-l-4 border-gray-300 bg-gray-50 p-4">
            {/* Top-level content from original side (can be truly blank) */}
            <div className="font-mono text-sm whitespace-pre-wrap text-gray-700">{change.content || ''}</div>
            {/* Nested subtree from original side */}
            <div className="mt-3">
              <NestedSubpageList rootNode={change.node} context={context} side="original" />
            </div>
          </div>
        );
      case 'moved':
        return change.content ? (
          <div className="mt-3 rounded-lg border-l-4 border-gray-300 bg-gray-50 p-4">
            <div className="font-mono text-sm whitespace-pre-wrap text-gray-700">{change.content}</div>
          </div>
        ) : null;

      case 'edited':
        const { newContent, oldContent } = change.changes;
        return newContent !== null && oldContent !== null ? (
          <div className="mt-3 rounded-lg border-l-4 border-blue-300 bg-blue-50 p-4">
            <div className="font-mono text-sm">
              <InlineTextDiff newContent={newContent} oldContent={oldContent} />
            </div>
          </div>
        ) : null;

      default:
        return null;
    }
  };

  const getActionColor = () => {
    switch (type) {
      case 'added':
        return 'text-green-700';
      case 'deleted':
        return 'text-red-700';
      case 'edited':
        return 'text-blue-700';
      case 'moved':
        return 'text-purple-700';
      default:
        return 'text-gray-700';
    }
  };

  const getActionBackgroundColor = () => {
    switch (type) {
      case 'added':
        return 'bg-green-100';
      case 'deleted':
        return 'bg-red-100';
      case 'edited':
        return 'bg-blue-100';
      case 'moved':
        return 'bg-purple-100';
      default:
        return 'bg-gray-100';
    }
  };

  const getDescriptionText = () => {
    const title = canonicalDocumentTitle || 'Untitled Document';

    switch (type) {
      case 'added':
        return `${title}`;
      case 'deleted':
        return `${title}`;
      case 'edited':
        return `${title} and its subdocuments to read as follows`;
      case 'moved':
        return `${title} to a new location`;
      default:
        return title;
    }
  };

  return (
    <div className="border-b border-gray-200 pb-6 last:border-b-0 last:pb-0">
      <div className="mb-1 flex items-start gap-2">
        <span className="leading-relaxed font-bold text-gray-900">
          <span className={`rounded p-1 uppercase ${getActionBackgroundColor()} ${getActionColor()}`}>
            {getActionText()}
          </span>{' '}
          {getDescriptionText()}
        </span>
      </div>

      {/* Additional context for moved items */}
      {type === 'moved' && (
        <div className="mt-2 ml-6 rounded bg-purple-50 px-3 py-2 text-sm text-gray-600">
          <strong>Moved to:</strong>
          {change.changes.oldParentId !== change.changes.newParentId && ` ${change.changes.newCanonicalDocumentTitle}`}
        </div>
      )}

      {renderContent()}
    </div>
  );
}
