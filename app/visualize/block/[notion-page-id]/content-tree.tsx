'use client';

import { NotionBlock } from '@/app/server/database/notion-block';
import { Tree, TreeNode } from '@/app/server/services/diff/tree';

function renderTreeNode(node: TreeNode, blockIdMap: Map<string, NotionBlock>, depth: number = 0): React.ReactElement {
  const block = blockIdMap.get(node.id);
  const content = block?.plain_text_content || ``;

  return (
    <li key={node.id} className="mb-1 ml-3">
      <div className="font-medium">{content}</div>
      {node.children && node.children.length > 0 && (
        <ul className="mt-1 ml-4 border-l border-gray-200 pl-4">
          {node.children.map((child) => renderTreeNode(child, blockIdMap, depth + 1))}
        </ul>
      )}
    </li>
  );
}

export default function ContentTree({ tree, blockIdMap }: { tree: Tree; blockIdMap: Map<string, NotionBlock> }) {
  return (
    <div className="mt-4">
      <h3 className="mb-3 text-lg font-semibold">{blockIdMap.get(tree.root.id)?.plain_text_content}</h3>
      <ul className="space-y-1">{tree.root.children?.map((node) => renderTreeNode(node, blockIdMap))}</ul>
    </div>
  );
}
