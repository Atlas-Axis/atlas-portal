'use client';

import { Button } from '@heroui/react';

export default function Home() {
  return (
    <div>
      <h1 className="mb-3 text-2xl font-bold">Embedded Page</h1>
      <Button variant="solid" color="primary">
        Click me
      </Button>
    </div>
  );
}
