/**
 * Atlas services exports
 */

export { convertTreeChangesToAtlasProposal } from './proposal-generation/old/generate-proposal';
export { generateAtlasProposalFromDiff, createMockProposalExample } from './proposal-generation/old/example-usage';
export type {
  ProposalContext,
  ProposalOptions,
  GroupedChanges,
  DocumentReference,
  FormattedChange,
} from './proposal-generation/old/proposal-types';
export {
  formatDocumentReference,
  formatDocumentReferenceString,
  calculateRelativePosition,
  formatDocumentContent,
  detectDocumentType,
  formatChangeEntry,
} from './proposal-generation/old/proposal-formatter';
