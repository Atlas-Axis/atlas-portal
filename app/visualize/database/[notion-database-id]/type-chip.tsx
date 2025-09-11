'use client';

import { Chip } from '@heroui/chip';
import { Database } from '@/app/server/services/supabase/database.types';

type NodeType = Database['public']['Enums']['atlas_document_type_enum'];

interface TypeChipProps {
  type: string;
}

const typeColorMap: Record<NodeType, string> = {
  Section: 'bg-blue-100 text-blue-800',
  Core: 'bg-red-100 text-red-800',
  'Type Specification': 'bg-purple-100 text-purple-800',
  'Active Data Controller': 'bg-green-100 text-green-800',
  'Spell SP Controller': 'bg-indigo-100 text-indigo-800',
  Placeholder: 'bg-gray-100 text-gray-800',
  Category: 'bg-yellow-100 text-yellow-800',
  'Action Tenet': 'bg-orange-100 text-orange-800',
  'Active Data': 'bg-emerald-100 text-emerald-800',
  Annotation: 'bg-pink-100 text-pink-800',
};

export default function TypeChip({ type }: TypeChipProps) {
  const colorClass = typeColorMap[type as NodeType] || 'bg-gray-100 text-gray-800';

  return <Chip className={colorClass}>{type}</Chip>;
}
