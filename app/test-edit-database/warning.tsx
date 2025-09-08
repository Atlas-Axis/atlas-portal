'use client';

import { Alert } from '@heroui/react';

export default function Warning() {
  return (
    <Alert
      color="danger"
      title="Don't use this page"
      description="This page will be deleted soon. We are now creating Edit Pages, not Edit Databases."
      className="mb-8 w-full"
    />
  );
}
