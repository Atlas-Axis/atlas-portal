/* eslint-disable @typescript-eslint/no-unused-vars */
import { NextRequest, NextResponse } from 'next/server';

const pushcutWebhookUrl =
  process.env.PUSHCUT_WEBHOOK_URL || 'https://api.pushcut.io/2bPya0Cr3P_UT9SYqs9Ds/notifications/Cursor%20finished';

export async function POST(request: NextRequest) {
  const secret = request.nextUrl.searchParams.get('secret');
  //   if (secret !== process.env.AGENT_NOTIFICATION_WEBHOOK_SECRET) {
  //     return NextResponse.json({ error: 'Invalid secret' }, { status: 401 });
  //   }
  const response = await fetch(pushcutWebhookUrl, {
    method: 'GET',
  });
  return NextResponse.json(await response.json());
}
