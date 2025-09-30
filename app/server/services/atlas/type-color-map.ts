import { AtlasDocumentType } from './constants';

export const typeColorMap: Record<AtlasDocumentType, string> = {
  Scope: 'bg-teal-50 text-teal-800',
  Article: 'bg-orange-50 text-orange-800',
  Section: 'bg-purple-50 text-purple-800',
  Core: 'bg-indigo-50 text-indigo-800',
  'Type Specification': 'bg-rose-50 text-rose-800',
  'Active Data Controller': 'bg-green-50 text-green-800',
  'Spell SP Controller': 'bg-red-50 text-red-800', // Deprecated - TODO: remove
  Placeholder: 'bg-gray-50 text-gray-800',
  Category: 'bg-yellow-50 text-yellow-800',
  'Action Tenet': 'bg-blue-50 text-blue-800',
  'Active Data': 'bg-fuchsia-50 text-fuchsia-800',
  Annotation: 'bg-pink-50 text-pink-800',
  Scenario: 'bg-blue-50 text-blue-800',
  'Scenario Variation': 'bg-lime-50 text-lime-800',
  'Needed Research': 'bg-amber-50 text-amber-800',
};
