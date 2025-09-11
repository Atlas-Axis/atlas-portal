import { parseArgs } from 'node:util';
import { convertSupabaseDatabasePagesToTreeNodes } from '@/app/server/diff/convert-supabase-database-pages-to-tree-nodes';
import { Tree, TreeNode, buildTree } from '@/app/server/diff/tree';
import { visualizeTree, visualizeTreeWithAscii } from '@/app/server/diff/visualize-tree';
import { withRootNode } from '@/app/server/diff/with-root-node';
import { ATLAS_DATABASES } from '@/app/server/services/atlas/constants';
import { loadNotionDatabasePagesFromSupabase } from '@/app/server/services/supabase/load-notion-database-pages-from-supabase';
import { loadEnv } from './utils/load-env';

/**
 * Calculate tree statistics for display
 */
function calculateTreeStats(tree: Tree) {
  let totalNodes = 0;
  let leafNodes = 0;
  let branchNodes = 0;
  let maxDepth = 0;

  function traverse(node: TreeNode, depth: number) {
    totalNodes++;
    maxDepth = Math.max(maxDepth, depth);

    if (!node.children || node.children.length === 0) {
      leafNodes++;
    } else {
      branchNodes++;
      for (const child of node.children) {
        traverse(child, depth + 1);
      }
    }
  }

  traverse(tree.root, 0);

  return {
    totalNodes,
    rootChildren: tree.root.children?.length || 0,
    maxDepth,
    leafNodes,
    branchNodes,
  };
}

// #!/usr/bin/env node
async function main() {
  const startTime = Date.now();
  const { values: args } = parseArgs({
    args: process.argv.slice(2),
    options: {
      help: {
        type: 'boolean',
        short: 'h',
        description: 'Show help message',
      },
      verbose: {
        type: 'boolean',
        short: 'v',
        description: 'Enable verbose output',
      },
      ascii: {
        type: 'boolean',
        short: 'a',
        description: 'Use ASCII tree visualization with └── and ├── characters',
      },
      'atlas-database': {
        type: 'string',
        short: 'd',
        description: 'Atlas database to visualize (default: sections)',
      },
    },
    strict: true,
  });

  if (args.help) {
    console.log(`Usage: npx tsx scripts/visualize-hierarchy [options]

Options:
  -h, --help            Show help message
  -v, --verbose         Enable verbose output
  -a, --ascii           Use ASCII tree visualization with └── and ├── characters
  -d, --atlas-database  Atlas database to visualize (sections, primary-docs, etc.)

Examples:
  npx tsx scripts/visualize-hierarchy
  npx tsx scripts/visualize-hierarchy --ascii
  npx tsx scripts/visualize-hierarchy --verbose --ascii`);
    process.exit(0);
  }

  if (args.verbose) {
    console.log(`Verbose mode enabled`);
    process.env.DEBUG_LOGGING = 'true';
  }

  // Default to sections database
  const atlasDatabaseName = ATLAS_DATABASES.SECTIONS_AND_PRIMARY_DOCS;

  loadEnv();

  console.log(`Loading Atlas hierarchy from database: ${atlasDatabaseName}`);

  try {
    // Load pages from Supabase
    const pages = await loadNotionDatabasePagesFromSupabase({
      atlasDatabaseName,
    });

    if (pages.length === 0) {
      console.log('No pages found in database. Run import script first:');
      console.log('npx tsx scripts/import-notion-databases');
      process.exit(0);
    }

    console.log(`✅ Loaded ${pages.length} database rows from Supabase`);

    // Convert to tree nodes and build tree
    const treeNodes = convertSupabaseDatabasePagesToTreeNodes(pages);
    console.log(`📊 Converted ${treeNodes.length} pages to tree nodes`);

    // Debug: Check original root nodes before withRootNode
    const originalRootNodes = treeNodes.filter((node) => node.parentId === null);
    console.log(`🔍 Original root nodes before withRootNode: ${originalRootNodes.length}`);

    if (args.verbose) {
      console.log('First few original root nodes:');
      originalRootNodes.slice(0, 5).forEach((node) => {
        console.log(`  - ${node.id}: "${node.canonicalDocumentTitle}"`);
      });
    }

    // Make a copy to avoid mutation issues
    const treeNodesCopy = JSON.parse(JSON.stringify(treeNodes));
    const treeNodesWithRoot = withRootNode(treeNodesCopy);
    console.log(`🔍 Total nodes after withRootNode: ${treeNodesWithRoot.length}`);

    // Debug: Check root nodes after withRootNode
    const rootNodesAfter = treeNodesWithRoot.filter((node) => node.parentId === null);
    console.log(`🔍 Root nodes after withRootNode: ${rootNodesAfter.length}`);

    if (args.verbose && rootNodesAfter.length > 0) {
      console.log('Root nodes after withRootNode:');
      rootNodesAfter.forEach((node) => {
        console.log(`  - ${node.id}: "${node.canonicalDocumentTitle}"`);
      });
    }

    const tree: Tree = buildTree(treeNodesWithRoot);
    console.log(`🔍 Tree nodeMap size: ${tree.nodeMap.size}`);
    console.log(`🔍 Tree root children count: ${tree.root.children?.length || 0}`);

    // Calculate tree statistics
    const stats = calculateTreeStats(tree);
    console.log(`🌳 Tree built successfully:`);
    console.log(`   • Total nodes: ${stats.totalNodes}`);
    console.log(`   • Root children: ${stats.rootChildren}`);
    console.log(`   • Max depth: ${stats.maxDepth}`);
    console.log(`   • Leaf nodes: ${stats.leafNodes}`);
    console.log(`   • Branch nodes: ${stats.branchNodes}`);

    console.log('\n');

    // Visualize the tree
    if (args.ascii) {
      visualizeTreeWithAscii(tree);
    } else {
      visualizeTree(tree);
    }

    const endTime = Date.now();
    const durationSeconds = ((endTime - startTime) / 1000).toFixed(2);
    console.log(`\n⏰ Processing time: ${durationSeconds} seconds`);
  } catch (error) {
    console.error(`Error visualizing hierarchy:`, error);
    process.exit(1);
  }
}

/**
 * Usage:
 * npx tsx scripts/visualize-hierarchy
 * npx tsx scripts/visualize-hierarchy --help
 * npx tsx scripts/visualize-hierarchy --verbose
 * npx tsx scripts/visualize-hierarchy --ascii
 * npx tsx scripts/visualize-hierarchy --atlas-database primary-docs
 */
main().catch((err) => {
  console.error(err);
  process.exit(1);
});
