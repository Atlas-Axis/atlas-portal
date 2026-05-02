import { AtlasDocumentType } from '../atlas-types';

export const typeColorMap: Record<AtlasDocumentType, string> = {
  Scope: 'bg-teal-50 text-teal-800 dark:bg-teal-950 dark:text-teal-200',
  Article: 'bg-orange-50 text-orange-800 dark:bg-orange-950 dark:text-orange-200',
  Section: 'bg-purple-50 text-purple-800 dark:bg-purple-950 dark:text-purple-200',
  Core: 'bg-indigo-50 text-indigo-800 dark:bg-indigo-950 dark:text-indigo-200',
  'Type Specification': 'bg-rose-50 text-rose-800 dark:bg-rose-950 dark:text-rose-200',
  'Active Data Controller': 'bg-green-50 text-green-800 dark:bg-green-950 dark:text-green-200',
  'Action Tenet': 'bg-blue-50 text-blue-800 dark:bg-blue-950 dark:text-blue-200',
  'Active Data': 'bg-fuchsia-50 text-fuchsia-800 dark:bg-fuchsia-950 dark:text-fuchsia-200',
  Annotation: 'bg-pink-50 text-pink-800 dark:bg-pink-950 dark:text-pink-200',
  Scenario: 'bg-blue-50 text-blue-800 dark:bg-blue-950 dark:text-blue-200',
  'Scenario Variation': 'bg-lime-50 text-lime-800 dark:bg-lime-950 dark:text-lime-200',
  'Needed Research': 'bg-amber-50 text-amber-800 dark:bg-amber-950 dark:text-amber-200',
};
