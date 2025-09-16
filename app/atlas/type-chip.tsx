'use client';

import { Chip } from '@heroui/chip';
import { AtlasDocumentType } from '@/app/server/services/atlas/constants';

const typeColorMap: Record<AtlasDocumentType, string> = {
  Scope: 'bg-teal-100 text-teal-800',
  Article: 'bg-orange-100 text-orange-800',
  Section: 'bg-blue-100 text-blue-800',
  Core: 'bg-indigo-100 text-indigo-800',
  'Type Specification': 'bg-purple-100 text-purple-800',
  'Active Data Controller': 'bg-green-100 text-green-800',
  'Spell SP Controller': 'bg-red-100 text-red-800',
  Placeholder: 'bg-gray-100 text-gray-800',
  Category: 'bg-yellow-100 text-yellow-800',
  'Action Tenet': 'bg-blue-100 text-blue-800',
  'Active Data': 'bg-emerald-100 text-emerald-800',
  Annotation: 'bg-pink-100 text-pink-800',
  Scenario: 'bg-cyan-100 text-cyan-800',
  'Scenario Variation': 'bg-lime-100 text-lime-800',
};

export default function TypeChip({ type }: { type: AtlasDocumentType }) {
  const colorClass = typeColorMap[type] || 'bg-gray-100 text-gray-800';

  return (
    <Chip className={colorClass} size="sm">
      {type}
    </Chip>
  );
}
