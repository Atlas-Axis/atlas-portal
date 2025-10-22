'use client';

import { useEffect, useRef, useState } from 'react';
import { Alert, Button, Card, CardBody, CardHeader, Code, Divider } from '@heroui/react';
import { CheckCircle, Loader2, PlayCircle, RotateCcw, XCircle } from 'lucide-react';
import { createNestedPage, deleteAllTestPages } from './_actions/nesting-demo-actions';

const TEST_DATABASE_ID = '2944c4a7469b808b9ec6eeb59d239049';
const MAX_NESTING_LEVEL = 15;
const DELAY_BETWEEN_PAGES = 50; // ms

interface LogEntry {
  level: number;
  pageCreated: boolean;
  parentItemSet: boolean;
  subItemSet: boolean;
  pageUrl: string;
  pageName: string;
  error?: string;
}

export default function NotionNestingBugDemo() {
  const [isRunning, setIsRunning] = useState(false);
  const [isResetting, setIsResetting] = useState(false);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [currentLevel, setCurrentLevel] = useState(0);
  const [iframeKey, setIframeKey] = useState(0);
  const logContainerRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when logs update
  useEffect(() => {
    if (logContainerRef.current) {
      logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight;
    }
  }, [logs]);

  const addLog = (entry: LogEntry) => {
    setLogs((prev) => [...prev, entry]);
  };

  const runDemo = async () => {
    setIsRunning(true);
    setLogs([]);
    setCurrentLevel(0);

    let parentId: string | null = null;

    // Create nested pages from level 1 to MAX_NESTING_LEVEL
    for (let level = 1; level <= MAX_NESTING_LEVEL; level++) {
      setCurrentLevel(level);

      const result = await createNestedPage(parentId, level);

      addLog({
        level,
        pageCreated: result.success,
        parentItemSet: result.parentItemSet,
        subItemSet: result.subItemSet,
        pageUrl: result.pageUrl,
        pageName: result.pageName,
        error: result.error,
      });

      if (result.success) {
        parentId = result.pageId;
      }

      // Refresh iframe to show the newly created page
      setIframeKey((prev) => prev + 1);

      // Delay before creating next page
      if (level < MAX_NESTING_LEVEL) {
        await new Promise((resolve) => setTimeout(resolve, DELAY_BETWEEN_PAGES));
      }
    }

    setIsRunning(false);
  };

  const resetDatabase = async () => {
    setIsResetting(true);

    try {
      const result = await deleteAllTestPages();

      if (result.success) {
        setLogs([]);
        setCurrentLevel(0);
        // Refresh iframe after reset
        setIframeKey((prev) => prev + 1);
        alert(`Successfully deleted ${result.deletedCount} page(s)`);
      } else {
        alert(`Error: ${result.error}`);
      }
    } catch (error) {
      alert(`Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsResetting(false);
    }
  };

  const getStatusIcon = (status: boolean) => {
    return status ? (
      <CheckCircle className="text-success inline h-4 w-4" />
    ) : (
      <XCircle className="text-danger inline h-4 w-4" />
    );
  };

  const codeExample = `// Simplified reproduction code
const { Client } = require('@notionhq/client');
const notion = new Client({ auth: 'YOUR_API_KEY' });

const DATABASE_ID = '${TEST_DATABASE_ID}';

async function createNestedPages() {
  let parentId = null;
  
  // Create 15 nested pages
  for (let level = 1; level <= 15; level++) {
    const properties = {
      Name: {
        title: [{ 
          type: 'text',
          text: { content: \`Level \${level} Page\` }
        }]
      }
    };
    
    // Add Parent item relationship if we have a parent
    if (parentId) {
      properties['Parent item'] = {
        relation: [{ id: parentId }]
      };
    }
    
    const newPage = await notion.pages.create({
      parent: { 
        type: 'database_id',
        database_id: DATABASE_ID 
      },
      properties
    });
    
    // Wait for Notion to process relationships
    await new Promise(resolve => setTimeout(resolve, 500));
    
    // Check if relationships were set correctly
    const createdPage = await notion.pages.retrieve({ 
      page_id: newPage.id 
    });
    
    const parentPage = parentId 
      ? await notion.pages.retrieve({ page_id: parentId })
      : null;
    
    console.log(\`Level \${level}:\`);
    console.log(\`  Parent item set: \${createdPage.properties['Parent item']?.relation?.length > 0}\`);
    console.log(\`  Sub-item set: \${parentPage?.properties['Sub-item']?.relation?.some(r => r.id === newPage.id) ?? 'N/A'}\`);
    
    // ❌ After level 10, Sub-item relationship fails to be set
    
    parentId = newPage.id;
  }
}

createNestedPages();`;

  return (
    <div className="mx-auto max-w-7xl space-y-6 p-6">
      {/* Header */}
      <Card className="p-6">
        <CardHeader>
          <h1 className="text-3xl font-bold">Notion Bug Demo - Nesting 10+ levels</h1>
        </CardHeader>
        <CardBody className="space-y-4">
          <Alert
            color="warning"
            title="Issue Description"
            description='When using Notion&apos;s dual "Parent item" / "Sub-item" relationships in a Notion database, nesting pages beyond 10 levels causes the "Sub-item" relationship on the parent page to fail. Both when using the UI, and when using the Notion API. The child page&apos;s "Parent item" relationship is set correctly, but the parent&apos;s "Sub-item" array does not include the child.'
            classNames={{ title: 'text-lg font-semibold' }}
          />

          <div className="text-default-600 text-sm">
            Learn more about Notion&apos;s Sub-items feature:{' '}
            <a
              href="https://www.notion.com/help/tasks-and-dependencies"
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary hover:text-primary-600 underline"
            >
              Notion Docs - Sub-items & dependencies
            </a>
          </div>

          <div className="space-y-2">
            <h2 className="text-lg font-semibold">Test Database</h2>
            <p className="text-default-600 text-sm">
              Notion Database ID: <Code>{TEST_DATABASE_ID}</Code>
            </p>
            <p className="text-default-600 text-sm">
              This demo will create 15 nested pages (Level 1 → Level 2 → ... → Level 15) and check if the dual
              relationships are set correctly at each level.
            </p>
          </div>
        </CardBody>
      </Card>

      {/* Controls */}
      <Card className="p-6">
        <CardBody className="flex flex-row items-center justify-center gap-4">
          <Button
            color="primary"
            size="lg"
            onPress={runDemo}
            isDisabled={isRunning || isResetting}
            startContent={isRunning ? <Loader2 className="h-5 w-5 animate-spin" /> : <PlayCircle className="h-5 w-5" />}
          >
            {isRunning ? `Running... (Level ${currentLevel}/${MAX_NESTING_LEVEL})` : 'Start Demo'}
          </Button>

          <Button
            color="danger"
            variant="flat"
            size="lg"
            onPress={resetDatabase}
            isDisabled={isRunning || isResetting}
            startContent={
              isResetting ? <Loader2 className="h-5 w-5 animate-spin" /> : <RotateCcw className="h-5 w-5" />
            }
          >
            {isResetting ? 'Resetting...' : 'Reset Database'}
          </Button>
        </CardBody>
      </Card>

      {/* Status Log */}
      {logs.length > 0 && (
        <Card className="p-6">
          <CardHeader>
            <h2 className="text-xl font-semibold">Test Results</h2>
          </CardHeader>
          <CardBody>
            <div ref={logContainerRef} className="bg-default-100 max-h-96 space-y-2 overflow-y-auto rounded-lg p-4">
              {logs.map((log, index) => (
                <div
                  key={index}
                  className={`rounded border-l-4 p-3 text-sm ${
                    log.pageCreated && log.parentItemSet && log.subItemSet
                      ? 'border-success bg-success-50'
                      : 'border-danger bg-danger-50'
                  }`}
                >
                  <div className="font-semibold">Level {log.level}</div>
                  <div className="mt-1 space-y-1">
                    <div>
                      Page Created: {getStatusIcon(log.pageCreated)}{' '}
                      {log.pageCreated && (
                        <a
                          href={log.pageUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-primary underline"
                        >
                          {log.pageName}
                        </a>
                      )}
                    </div>
                    {log.pageCreated && (
                      <>
                        <div>
                          &quot;Parent item&quot; relationship: {getStatusIcon(log.parentItemSet)}{' '}
                          {log.parentItemSet ? 'Set' : 'Empty'}
                        </div>
                        <div>
                          &quot;Sub-item&quot; relationship: {getStatusIcon(log.subItemSet)}{' '}
                          {log.subItemSet ? 'Set' : 'Empty'}
                        </div>
                      </>
                    )}
                    {log.error && <div className="text-danger">Error: {log.error}</div>}
                  </div>
                </div>
              ))}
            </div>
          </CardBody>
        </Card>
      )}

      {/* Embedded Notion Database */}
      <Card className="p-6">
        <CardHeader>
          <h2 className="text-xl font-semibold">Live Notion Database View</h2>
        </CardHeader>
        <CardBody>
          <iframe
            key={iframeKey}
            src="https://billowy-spark-eb1.notion.site/ebd/2944c4a7469b808b9ec6eeb59d239049?v=2944c4a7469b804d8f80000ccc396630"
            className="border-default-200 h-[800px] w-full rounded-xl border-2"
            width="100%"
            height="800"
            frameBorder="0"
            allowFullScreen
            title="Notion Database"
          />
        </CardBody>
      </Card>

      <Divider />

      {/* Code Example */}
      <Card className="p-6">
        <CardHeader>
          <h2 className="text-xl font-semibold">Reproduction Code</h2>
        </CardHeader>
        <CardBody>
          <p className="text-default-600 mb-4 text-sm">
            Below is a simplified Node.js code example that reproduces this issue. You can copy and run this in your own
            environment with your Notion API key.
          </p>
          <pre className="bg-default-900 text-default-50 overflow-x-auto rounded-lg p-4 text-xs">{codeExample}</pre>
        </CardBody>
      </Card>
    </div>
  );
}
