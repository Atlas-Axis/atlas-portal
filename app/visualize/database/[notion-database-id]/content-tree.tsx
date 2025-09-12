'use client';

import { NotionDatabasePage } from '@/app/server/database/notion-database-page';
import { Tree, TreeNode } from '@/app/server/diff/tree';
import { AtlasDatabaseName, AtlasDocumentType } from '@/app/server/services/atlas/constants';
import { uuidToNoHyphens } from '@/app/shared/utils/utils';
import TypeChip from './type-chip';

function renderTreeNode(
  node: TreeNode,
  pageIdMap: Map<string, NotionDatabasePage>,
  depth: number = 0, // TODO: Remove, unused
): React.ReactElement {
  const page = pageIdMap.get(node.id);
  const content = page?.plain_text_content || ``;

  return (
    <li key={node.id} className="my-3 ml-3 border-t-1 border-gray-100 pt-3">
      <h3 className="text-base font-semibold">
        {pageIdMap.get(node.id)?.canonical_document_title} <TypeChip type={node.type as AtlasDocumentType} />
      </h3>
      <div className="text-xs font-medium text-gray-800">{content}</div>
      <div className="text-xs text-gray-300">{`Node ID: ${uuidToNoHyphens(node.id)}, Parent ID: ${uuidToNoHyphens(node.parentId || '')}`}</div>
      {node.children && node.children.length > 0 && (
        <ul className="mt-1 ml-4 border-l border-gray-200 pl-4">
          {node.children.map((child) => renderTreeNode(child, pageIdMap, depth + 1))}
        </ul>
      )}
    </li>
  );
}

export default function ContentTree({
  tree,
  pageIdMap,
  atlasDatabaseName,
}: {
  tree: Tree;
  pageIdMap: Map<string, NotionDatabasePage>;
  atlasDatabaseName: AtlasDatabaseName | undefined;
}) {
  return (
    <div className="mt-4">
      <h3 className="mb-6 text-3xl font-semibold">{atlasDatabaseName}</h3>
      <ul className="space-y-1 text-sm">{tree.root.children?.map((node) => renderTreeNode(node, pageIdMap))}</ul>
    </div>
  );
}
