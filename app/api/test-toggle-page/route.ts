import { NextRequest, NextResponse } from 'next/server';
import { createNotionPageWithToggleBlocks } from '@/app/server/services/notion/create-toggle-page';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { originalNotionDatabaseId, rootNotionPageId, parent } = body;

    // Validate required parameters
    if (!originalNotionDatabaseId) {
      return NextResponse.json({ error: 'originalNotionDatabaseId is required' }, { status: 400 });
    }

    if (!rootNotionPageId) {
      return NextResponse.json({ error: 'rootNotionPageId is required' }, { status: 400 });
    }

    if (!parent) {
      return NextResponse.json({ error: 'parent is required' }, { status: 400 });
    }

    const startTime = performance.now();

    // Call the main function
    const result = await createNotionPageWithToggleBlocks({
      originalNotionDatabaseId,
      rootNotionPageId,
      taskRunId: `test-${Date.now()}`, // Generate a test task run ID
      parent,
    });

    const endTime = performance.now();
    const duration = endTime - startTime;

    return NextResponse.json({
      ...result,
      duration,
      details: {
        originalNotionDatabaseId,
        rootNotionPageId,
        parent,
      },
    });
  } catch (error) {
    console.error('API Error:', error);

    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Unknown error occurred',
        details: error instanceof Error ? error.stack : undefined,
      },
      { status: 500 },
    );
  }
}
