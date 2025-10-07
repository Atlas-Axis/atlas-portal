import { NextResponse } from 'next/server';
import { buildAtlasJSON } from '@/app/server/atlas/json-export/atlas-json-exporter';

export async function GET() {
  try {
    const atlasJSON = await buildAtlasJSON();

    // Generate filename with current date
    const currentDate = new Date().toISOString().split('T')[0]; // YYYY-MM-DD format
    const filename = `atlas-supabase-${currentDate}.json`;

    return new NextResponse(JSON.stringify(atlasJSON, null, 2), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    });
  } catch (error) {
    console.error('Error generating Atlas JSON:', error);
    return NextResponse.json({ error: 'Failed to generate Atlas JSON' }, { status: 500 });
  }
}
