'use client';

import { AtlasDocumentType } from '@/app/server/services/atlas/constants';
import { typeColorMap } from '../server/services/atlas/type-color-map';

export default function TypeChip({ type }: { type: AtlasDocumentType }) {
  const colorClass = typeColorMap[type] || 'bg-gray-100 text-gray-800';

  return (
    <span className={`inline-flex items-center rounded-md px-2 py-1 text-xs font-medium ${colorClass}`}>{type}</span>
  );
}
