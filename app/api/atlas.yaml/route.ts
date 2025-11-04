import { NextResponse } from 'next/server';
import { stringify } from 'yaml';
import { buildAtlasJSON } from '@/app/server/atlas/json-export/atlas-json-exporter';

interface ConversionOptions {
  indent: number;
  lineWidth: number;
  minContentWidth: number;
  noRefs: boolean;
  sortKeys: boolean;
}

const DEFAULT_OPTIONS: ConversionOptions = {
  indent: 2,
  lineWidth: 120,
  minContentWidth: 0,
  noRefs: true,
  sortKeys: false,
};

export async function GET() {
  try {
    const atlasJSON = await buildAtlasJSON();

    // Convert to YAML
    const yamlContent = stringify(atlasJSON, DEFAULT_OPTIONS);

    // Generate filename with current date
    const currentDate = new Date().toISOString().split('T')[0]; // YYYY-MM-DD format
    const filename = `atlas-${currentDate}.yaml`;

    return new NextResponse(yamlContent, {
      status: 200,
      headers: {
        'Content-Type': 'application/x-yaml; charset=utf-8',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    });
  } catch (error) {
    console.error('Error generating Atlas JSON:', error);
    return NextResponse.json({ error: 'Failed to generate Atlas JSON' }, { status: 500 });
  }
}
