import { InlineTextDiff } from '@/app/components/inline-text-diff';

export default async function Page() {
  return (
    <div>
      <h1 className="mb-3 text-2xl font-bold">Changes</h1>
      <div>
        <InlineTextDiff
          newContent={`Lorem ipsum dolor sit amet, consectetur adipiscing elit.`}
          oldContent={`Lorem ipsum sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.`}
        />
      </div>
    </div>
  );
}
