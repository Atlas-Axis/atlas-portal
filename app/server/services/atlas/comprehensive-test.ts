/**
 * Comprehensive test for the Atlas proposal generator
 */
import { TreeChange } from '../../diff/diff-trees';
import { TreeNode } from '../../diff/tree';
import { convertTreeChangesToAtlasProposal } from './generate-proposal';
import { ProposalContext } from './proposal-types';

/**
 * Create a comprehensive test with all change types and features
 */
export function createComprehensiveTest(): string {
  // Mock tree nodes with relationships
  const parentNode: TreeNode = {
    id: 'parent-1',
    parentId: null,
    type: 'page',
    sortOrder: 0,
    canonicalDocumentTitle: 'A.1.9.2.2.10 - Bounded External Access Modules',
    children: [],
  };

  const siblingNode: TreeNode = {
    id: 'sibling-1',
    parentId: 'parent-1',
    type: 'paragraph',
    sortOrder: 1,
    canonicalDocumentTitle: 'A.1.9.2.2.10.2 - Stability Parameter Bounded External Access Module Exception',
    children: [],
  };

  const newParentNode: TreeNode = {
    id: 'new-parent-1',
    parentId: null,
    type: 'page',
    sortOrder: 0,
    canonicalDocumentTitle: 'A.3.3.2.1.2.2 - Smart Contract Risk Rating Calculation',
    children: [],
  };

  // Create mock changes covering all scenarios
  const changes: TreeChange[] = [
    // Addition with parent and relative position
    {
      type: 'added',
      node: {
        id: 'added-1',
        parentId: 'parent-1',
        type: 'paragraph',
        sortOrder: 2,
        canonicalDocumentTitle: 'A.1.9.2.2.10.3 - stUSDS Bounded External Access Module Exception',
        children: [],
      },
      parentId: 'parent-1',
      content:
        'The stUSDS Bounded External Access Module (stUSDS BEAM) manages the parameters of the stUSDS system. Whitelisted operators can use the stUSDS BEAM to modify rates without waiting for the GSM Pause Delay. The stUSDS BEAM modifies stUSDS parameters within specified ranges. See A.4.4 - stUSDS Bounded External Access Module.\n\nThis functionality allows the Sky Protocol to update stUSDS parameters more quickly than waiting for the Governance and Spell Process execution and the GSM Pause Delay.\n\nThe risk opened up by this functionality is malicious action by whitelisted operators setting stUSDS parameters to undesirable values. This risk can be mitigated through the stUSDS BEAM parameters and the STUSDS_MOM.',
      canonicalDocumentTitle: 'A.1.9.2.2.10.3 - stUSDS Bounded External Access Module Exception',
    },

    // Replacement with subtree
    {
      type: 'edited',
      node: {
        id: 'edited-1',
        parentId: 'parent-2',
        type: 'paragraph',
        sortOrder: 0,
        canonicalDocumentTitle: 'A.4.4.1.2.2 - stUSDS Rate',
        children: [],
      },
      parentId: 'parent-2',
      changes: {
        newContent: 'The variable yield earned by stUSDS holders is calculated using the formula',
        oldContent: 'Old content about stUSDS rate calculation',
      },
      canonicalDocumentTitle: 'A.4.4.1.2.2 - stUSDS Rate',
    },

    // Simple deletion
    {
      type: 'deleted',
      node: {
        id: 'deleted-1',
        parentId: 'parent-3',
        type: 'paragraph',
        sortOrder: 0,
        canonicalDocumentTitle: 'A.3.3.2.1.2.2.5.1 - Base Risk',
        children: [],
      },
      parentId: 'parent-3',
      content: 'Content about base risk calculation',
      canonicalDocumentTitle: 'A.3.3.2.1.2.2.5.1 - Base Risk',
    },

    // Move with new parent and position
    {
      type: 'moved',
      node: {
        id: 'moved-1',
        parentId: 'new-parent-1',
        type: 'paragraph',
        sortOrder: 1,
        canonicalDocumentTitle: 'A.3.3.2.1.2.2.5.2 - Audit Factor',
        children: [],
      },
      parentId: 'new-parent-1',
      content: 'Audit factor content',
      changes: {
        newParentId: 'new-parent-1',
        oldParentId: 'old-parent-1',
        newPosition: 1,
        oldPosition: 0,
        oldCanonicalDocumentTitle: 'A.3.3.2.1.2.2.5.2 - Audit Factor',
        newCanonicalDocumentTitle: 'A.3.3.2.1.2.2.5.2 - Audit Factor',
      },
      canonicalDocumentTitle: 'A.3.3.2.1.2.2.5.2 - Audit Factor',
    },
  ];

  // Create comprehensive node maps
  const nodeMap = new Map([
    ['parent-1', parentNode],
    ['sibling-1', siblingNode],
    ['new-parent-1', newParentNode],
  ]);

  // Set up parent-child relationships
  parentNode.children = [siblingNode];

  const contentMap = new Map([
    ['parent-1', 'Parent content'],
    ['sibling-1', 'Sibling content'],
    ['new-parent-1', 'New parent content'],
  ]);

  const context: ProposalContext = {
    originalNodeMap: nodeMap,
    duplicateNodeMap: nodeMap,
    originalRoot: parentNode,
    duplicateRoot: parentNode,
    originalContentMap: contentMap,
    duplicateContentMap: contentMap,
  };

  return convertTreeChangesToAtlasProposal(changes, context, {
    includeSubtree: true,
    maxSubtreeDepth: 2,
    groupingStrategy: 'none',
  });
}

// For testing:
// console.log('=== Comprehensive Atlas Proposal Test ===');
// console.log(createComprehensiveTest());
