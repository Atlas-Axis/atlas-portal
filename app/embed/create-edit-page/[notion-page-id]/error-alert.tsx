'use client';

import { Alert } from '@heroui/react';

export function ErrorAlert({ message }: { message: string }) {
  return <Alert color="danger" description={message} />;
}
