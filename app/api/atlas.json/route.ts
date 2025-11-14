import { NextResponse } from 'next/server';
import { buildExportAtlasTreeJSON } from '@/app/server/atlas/export/atlas-json-exporter';

export async function GET() {
  try {
    const atlasJSON = await buildExportAtlasTreeJSON();

    // Generate filename with current date
    const currentDate = new Date().toISOString().split('T')[0]; // YYYY-MM-DD format
    const filename = `atlas-${currentDate}.json`;

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
