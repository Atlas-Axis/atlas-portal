/**
 * Example usage of the Atlas proposal generator
 * This file demonstrates how to integrate the proposal generator with the diff system
 */
import { TreeChange, diffTrees } from '../../diff/diff-trees';
import { TreeNode, TreeNodeMap } from '../../diff/tree';
import { convertTreeChangesToAtlasProposal } from './generate-proposal';
import { ProposalContext } from './proposal-types';

/**
 * Example function showing how to use the proposal generator after running diffTrees
 */
export function generateAtlasProposalFromDiff(
  originalNodeMap: TreeNodeMap,
  duplicateNodeMap: TreeNodeMap,
  originalRoot: TreeNode,
  duplicateRoot: TreeNode,
  originalContentMap: Map<string, string | null>,
  duplicateContentMap: Map<string, string | null>,
): string {
  // Step 1: Run the diff algorithm to get changes
  const changes: TreeChange[] = diffTrees({
    originalNodeMap,
    duplicateNodeMap,
    originalRoot,
    duplicateRoot,
    originalContentMap,
    duplicateContentMap,
  });

  // Step 2: Prepare context for proposal generation
  const context: ProposalContext = {
    originalNodeMap,
    duplicateNodeMap,
    originalRoot,
    duplicateRoot,
    originalContentMap,
    duplicateContentMap,
  };

  // Step 3: Generate the Atlas proposal markdown
  const proposalMarkdown = convertTreeChangesToAtlasProposal(changes, context, {
    includeSubtree: true,
    maxSubtreeDepth: 3, // Limit subtree depth to 3 levels
    groupingStrategy: 'none', // No logical grouping for now
  });

  return proposalMarkdown;
}

/**
 * Mock example data for testing the proposal generator
 */
export function createMockProposalExample(): string {
  // This would normally come from your actual tree data
  const mockChanges: TreeChange[] = [
    {
      type: 'added',
      node: {
        id: 'new-node-1',
        parentId: 'parent-1',
        type: 'paragraph',
        sortOrder: 1,
        rootNotionPageId: 'root-1',
        canonicalDocumentTitle: 'A.1.9.2.2.10.3 - stUSDS Bounded External Access Module Exception',
        children: [],
      },
      parentId: 'parent-1',
      content:
        'The stUSDS Bounded External Access Module (stUSDS BEAM) manages the parameters of the stUSDS system. Whitelisted operators can use the stUSDS BEAM to modify rates without waiting for the GSM Pause Delay.',
      canonicalDocumentTitle: 'A.1.9.2.2.10.3 - stUSDS Bounded External Access Module Exception',
    },
    {
      type: 'edited',
      node: {
        id: 'edited-node-1',
        parentId: 'parent-2',
        type: 'paragraph',
        sortOrder: 0,
        rootNotionPageId: 'root-1',
        canonicalDocumentTitle: 'A.4.4.1.2.2 - stUSDS Rate',
        children: [],
      },
      parentId: 'parent-2',
      changes: {
        newContent: 'The variable yield earned by stUSDS holders is calculated using the formula',
        oldContent: 'The old content that was replaced',
      },
      canonicalDocumentTitle: 'A.4.4.1.2.2 - stUSDS Rate',
    },
    {
      type: 'deleted',
      node: {
        id: 'deleted-node-1',
        parentId: 'parent-3',
        type: 'paragraph',
        sortOrder: 0,
        rootNotionPageId: 'root-1',
        canonicalDocumentTitle: 'A.3.3.2.1.2.2.5.1 - Base Risk',
        children: [],
      },
      parentId: 'parent-3',
      content: 'Content that was deleted',
      canonicalDocumentTitle: 'A.3.3.2.1.2.2.5.1 - Base Risk',
    },
  ];

  const mockContext: ProposalContext = {
    originalNodeMap: new Map(),
    duplicateNodeMap: new Map(),
    originalRoot: {
      id: 'root',
      parentId: null,
      type: 'page',
      sortOrder: 0,
      rootNotionPageId: 'root',
      canonicalDocumentTitle: 'Root Document',
      children: [],
    },
    duplicateRoot: {
      id: 'root',
      parentId: null,
      type: 'page',
      sortOrder: 0,
      rootNotionPageId: 'root',
      canonicalDocumentTitle: 'Root Document',
      children: [],
    },
    originalContentMap: new Map(),
    duplicateContentMap: new Map(),
  };

  return convertTreeChangesToAtlasProposal(mockChanges, mockContext, {
    includeSubtree: false,
    groupingStrategy: 'none',
  });
}

// Example usage:
// console.log('Mock Atlas Proposal:');
// console.log(createMockProposalExample());
