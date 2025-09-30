/**
 * Atlas services exports
 */

export { convertTreeChangesToAtlasProposal } from './generate-proposal';
export { generateAtlasProposalFromDiff, createMockProposalExample } from './example-usage';
export type {
  ProposalContext,
  ProposalOptions,
  GroupedChanges,
  DocumentReference,
  FormattedChange,
} from './proposal-types';
export {
  formatDocumentReference,
  formatDocumentReferenceString,
  calculateRelativePosition,
  formatDocumentContent,
  detectDocumentType,
  formatChangeEntry,
} from './proposal-formatter';
