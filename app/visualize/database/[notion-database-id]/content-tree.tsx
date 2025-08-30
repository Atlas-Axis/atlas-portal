'use client';

import { Divider } from '@heroui/react';
import { NotionDatabasePage } from '@/app/server/database/notion-database-page';
import { Tree, TreeNode } from '@/app/server/services/diff/tree';

function renderTreeNode(
  node: TreeNode,
  pageIdMap: Map<string, NotionDatabasePage>,
  depth: number = 0, // TODO: Remove, unused
): React.ReactElement {
  const page = pageIdMap.get(node.id);
  const content = page?.plain_text_content || ``;

  return (
    <li key={node.id} className="mb-1 ml-3">
      <h3 className="mb-3 text-lg font-semibold">{pageIdMap.get(node.id)?.canonical_document_title}</h3>
      <div className="font-medium">{content}</div>
      {node.children && node.children.length > 0 && (
        <ul className="mt-1 ml-4 border-l border-gray-200 pl-4">
          {node.children.map((child) => renderTreeNode(child, pageIdMap, depth + 1))}
        </ul>
      )}
      <Divider className="my-2" />
    </li>
  );
}

export default function ContentTree({ tree, pageIdMap }: { tree: Tree; pageIdMap: Map<string, NotionDatabasePage> }) {
  return (
    <div className="mt-4">
      <h3 className="mb-6 text-3xl font-semibold">Database</h3>
      <ul className="space-y-1 text-sm">{tree.root.children?.map((node) => renderTreeNode(node, pageIdMap))}</ul>
    </div>
  );
}
