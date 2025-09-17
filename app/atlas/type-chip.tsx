'use client';

import { Chip } from '@heroui/chip';
import { AtlasDocumentType } from '@/app/server/services/atlas/constants';
import { typeColorMap } from '../server/services/atlas/type-color-map';

export default function TypeChip({ type }: { type: AtlasDocumentType }) {
  const colorClass = typeColorMap[type] || 'bg-gray-100 text-gray-800';

  return (
    <Chip className={colorClass} size="sm">
      {type}
    </Chip>
  );
}
