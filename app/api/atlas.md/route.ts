import { NextResponse } from 'next/server';
import { buildAtlasMarkdown } from '@/app/server/atlas/json-export/atlas-markdown-exporter';

export async function GET() {
  try {
    const markdown = await buildAtlasMarkdown();

    // Generate filename with current date
    const currentDate = new Date().toISOString().split('T')[0]; // YYYY-MM-DD format
    const filename = `atlas-supabase-${currentDate}.md`;

    return new NextResponse(markdown, {
      status: 200,
      headers: {
        'Content-Type': 'text/markdown; charset=utf-8',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    });
  } catch (error) {
    console.error('Error generating Atlas Markdown:', error);
    return NextResponse.json({ error: 'Failed to generate Atlas Markdown' }, { status: 500 });
  }
}
