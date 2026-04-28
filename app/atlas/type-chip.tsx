'use client';

import { AtlasDocumentType } from '@/app/server/atlas/atlas-types';
import { typeColorMap } from '@/app/server/atlas/formatters/type-color-map';

export default function TypeChip({ type }: { type: AtlasDocumentType }) {
  const colorClass = typeColorMap[type] || 'bg-gray-100 text-gray-800';
  let color: string = type;

  if (type === 'Action Tenet') {
    color = 'Tenet';
  }

  return (
    <span className={`ml-2 inline-flex items-center rounded-md px-2 py-1 text-xs font-medium ${colorClass}`}>
      {color}
    </span>
  );
}
