import Page from './atlas/page';

// Force the route static (see app/atlas/page.tsx for the full rationale).
// Same as /atlas — / is just a thin alias that renders the Atlas page.
export const dynamic = 'force-static';
// Revalidate every hour — same cadence as the /atlas route —
// so both routes stay fresh on their own ISR cycle.
export const revalidate = 3600;

export default function Home() {
  return <Page />;
}
