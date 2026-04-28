import Page from './atlas/page';

// Revalidate every hour — same cadence as the /atlas route —
// so both routes stay fresh on their own ISR cycle.
export const revalidate = 3600;

export default function Home() {
  return <Page />;
}
