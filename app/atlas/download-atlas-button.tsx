'use client';

import { Button, Dropdown, DropdownItem, DropdownMenu, DropdownPopover, DropdownTrigger } from '@heroui/react';
import { Download } from 'lucide-react';

export default function DownloadAtlasButton() {
  return (
    <Dropdown>
      <DropdownTrigger>
        <Button variant="outline" className="w-full gap-2">
          <Download className="text-gray-500" size={16} />
          Download Atlas
        </Button>
      </DropdownTrigger>
      <DropdownPopover className="w-full">
        <DropdownMenu aria-label="Download options" className="w-full">
          <DropdownItem
            id="download-markdown"
            href="/api/atlas.md"
            target="_blank"
            className="w-full"
            textValue="Download as Markdown"
          >
            <Download className="text-gray-500" size={16} />
            Download as Markdown
          </DropdownItem>
          <DropdownItem
            id="download-markdown-split"
            href="/api/atlas.md?split-by-scope"
            target="_blank"
            className="w-full"
            textValue="Download as Markdown - Split by Scope"
          >
            <Download className="text-gray-500" size={16} />
            Download as Markdown - Split by Scope
          </DropdownItem>
          <DropdownItem
            id="download-json"
            href="/api/atlas.json"
            target="_blank"
            className="w-full"
            textValue="Download as JSON"
          >
            <Download className="text-gray-500" size={16} />
            Download as JSON
          </DropdownItem>
          <DropdownItem
            id="download-yaml"
            href="/api/atlas.yaml"
            target="_blank"
            className="w-full"
            textValue="Download as YAML"
          >
            <Download className="text-gray-500" size={16} />
            Download as YAML
          </DropdownItem>
        </DropdownMenu>
      </DropdownPopover>
    </Dropdown>
  );
}
