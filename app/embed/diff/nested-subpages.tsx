import { ProposalContext } from '@/app/server/atlas/proposal-generation/old/proposal-types';
import { TreeNode } from '@/app/server/diff/tree';

export function NestedSubpageList({
  rootNode,
  context,
  side,
}: {
  rootNode: TreeNode;
  context: ProposalContext;
  side: 'original' | 'duplicate';
}) {
  const children = rootNode.children || [];
  if (children.length === 0) {
    return null;
  }

  return (
    <ul className="list-disc pl-6">
      {children.map((child) => (
        <NestedSubpageItem key={`${side}-${child.id}`} node={child} context={context} side={side} />
      ))}
    </ul>
  );
}

function NestedSubpageItem({
  node,
  context,
  side,
}: {
  node: TreeNode;
  context: ProposalContext;
  side: 'original' | 'duplicate';
}) {
  const title = node.canonicalDocumentTitle || '[Untitled Document]';
  const contentMap = side === 'original' ? context.originalContentMap : context.duplicateContentMap;
  const content = contentMap.get(node.id) || '';

  return (
    <li className="mb-3">
      <div className="font-semibold">{title}</div>
      <div className="font-mono text-sm whitespace-pre-wrap text-gray-700">{content}</div>
      {node.children && node.children.length > 0 && (
        <div className="mt-2">
          <NestedSubpageList rootNode={node} context={context} side={side} />
        </div>
      )}
    </li>
  );
}
