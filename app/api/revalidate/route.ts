import { revalidatePath } from 'next/cache';
import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { path } = body;

    if (!path || typeof path !== 'string') {
      return NextResponse.json({ success: false, error: 'Missing parameter' }, { status: 400 });
    }

    // Call revalidatePath in proper Next.js context
    revalidatePath(path);

    return NextResponse.json({
      success: true,
      message: `Successfully revalidated path: ${path}`,
      revalidatedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Revalidation error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to revalidate path',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 },
    );
  }
}
