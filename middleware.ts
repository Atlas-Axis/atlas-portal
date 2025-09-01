import { NextRequest, NextResponse } from 'next/server';

export function middleware(request: NextRequest) {
  // Only apply headers to embed routes
  if (request.nextUrl.pathname.startsWith('/embed/')) {
    // Only apply headers to GET requests (HTML pages), not POST requests (server actions)
    if (request.method === 'GET') {
      const response = NextResponse.next();

      // Set headers for Notion iframe embedding
      response.headers.set('Content-Type', 'text/html; charset=utf-8');
      response.headers.set(
        'Content-Security-Policy',
        "frame-ancestors 'self' https://www.notion.so https://notion.so https://*.notion.so https://notion.site https://*.notion.site;",
      );
      response.headers.set('X-Content-Type-Options', 'nosniff');
      response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');

      return response;
    }
  }

  // For all other requests (including POST server actions), continue without modification
  return NextResponse.next();
}

export const config = {
  // Only run middleware on embed routes
  matcher: '/embed/:path*',
};
