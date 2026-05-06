import Page from './atlas/page';

// Build-time static generation. Mirror the /atlas route's caching
// strategy so the landing page is also a pure CDN serve. Updates ship
// via a Vercel Deploy Hook on upstream Atlas changes — see README.
export const dynamic = 'force-static';
export const revalidate = false;

export default function Home() {
  return <Page />;
}
