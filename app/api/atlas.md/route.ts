import { NextRequest, NextResponse } from 'next/server';
import { buildAtlasMarkdown, buildAtlasMarkdownsPerScope } from '@/app/server/atlas/json-export/atlas-markdown-exporter';
import archiver from 'archiver';

export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    const searchParams = request.nextUrl.searchParams;
    const splitByScope = searchParams.has('split-by-scope');
    const currentDate = getCurrentDateString();

    if (splitByScope) {
      return await handleSplitByScopeRequest(currentDate);
    } else {
      return await handleSingleMarkdownRequest(currentDate);
    }
  } catch (error) {
    console.error('Error generating Atlas Markdown:', error);
    return NextResponse.json({ error: 'Failed to generate Atlas Markdown' }, { status: 500 });
  }
}

/**
 * Generates the current date in YYYY-MM-DD format for filenames
 */
function getCurrentDateString(): string {
  return new Date().toISOString().split('T')[0]!;
}

/**
 * Handles the split-by-scope request: generates separate markdown files
 * for each scope and returns them as a ZIP archive
 */
async function handleSplitByScopeRequest(currentDate: string): Promise<NextResponse> {
  const markdownsByScope = await buildAtlasMarkdownsPerScope();
  const filename = `atlas-scopes-${currentDate}.zip`;
  const stream = createZipStream(markdownsByScope);

  return new NextResponse(stream, {
    status: 200,
    headers: {
      'Content-Type': 'application/zip',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  });
}

/**
 * Handles the single markdown request: generates one markdown file
 * containing the entire Atlas hierarchy
 */
async function handleSingleMarkdownRequest(currentDate: string): Promise<NextResponse> {
  const markdown = await buildAtlasMarkdown();
  const filename = `atlas-${currentDate}.md`;

  return new NextResponse(markdown, {
    status: 200,
    headers: {
      'Content-Type': 'text/markdown; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  });
}

/**
 * Creates a ReadableStream that generates a ZIP archive containing
 * multiple markdown files (one per scope)
 */
function createZipStream(markdownsByScope: Record<string, string>): ReadableStream<Uint8Array> {
  const archive = archiver('zip', {
    zlib: { level: 9 }, // Maximum compression
  });

  return new ReadableStream({
    start(controller) {
      // Convert Node.js Buffer chunks to Uint8Array for Web ReadableStream
      archive.on('data', (chunk: Buffer) => {
        controller.enqueue(new Uint8Array(chunk));
      });

      archive.on('end', () => {
        controller.close();
      });

      archive.on('error', (err: Error) => {
        controller.error(err);
      });

      // Add each scope's markdown as a separate file in the ZIP
      for (const [scopeName, markdownContent] of Object.entries(markdownsByScope)) {
        archive.append(markdownContent, { name: `${scopeName}.md` });
      }

      // Finalize the archive
      archive.finalize();
    },
  });
}
