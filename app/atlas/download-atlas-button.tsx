'use client';

import { Button, Dropdown, DropdownItem, DropdownMenu, DropdownTrigger } from '@heroui/react';
import { Download } from 'lucide-react';

export default function DownloadAtlasButton() {
  return (
    <Dropdown backdrop="blur">
      <DropdownTrigger>
        <Button
          variant="bordered"
          className="w-full"
          startContent={<Download className="text-default-500" size={16} />}
        >
          Download Atlas
        </Button>
      </DropdownTrigger>
      <DropdownMenu aria-label="Static Actions" className="w-full">
        <DropdownItem key="download-markdown" className="w-full">
          <Button
            variant="light"
            as="a"
            href="/api/atlas.md"
            target="_blank"
            startContent={<Download className="text-default-500" size={16} />}
          >
            Download as Markdown
          </Button>
        </DropdownItem>
        <DropdownItem key="download-json" className="w-full">
          <Button
            variant="light"
            as="a"
            href="/api/atlas.json"
            target="_blank"
            startContent={<Download className="text-default-500" size={16} />}
          >
            Download as JSON
          </Button>
        </DropdownItem>
        <DropdownItem key="download-yaml" className="w-full">
          <Button
            variant="light"
            as="a"
            href="/api/atlas.yaml"
            target="_blank"
            startContent={<Download className="text-default-500" size={16} />}
          >
            Download as YAML
          </Button>
        </DropdownItem>
      </DropdownMenu>
    </Dropdown>
  );
}
