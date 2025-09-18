import { Suspense } from 'react';
import './styles.css';

// Cache for 1 minute
const CACHE_MINUTES = 1;

async function AtlasContent() {
  try {
    const response = await fetch(
      'https://raw.githubusercontent.com/sky-ecosystem/next-gen-atlas/main/Sky%20Atlas/Sky%20Atlas.html',
      {
        next: { revalidate: CACHE_MINUTES * 60 },
      },
    );

    if (!response.ok) {
      throw new Error(`Failed to fetch Atlas HTML: ${response.status} ${response.statusText}`);
    }

    const htmlContent = await response.text();

    // Extract styles from the head section
    const styleMatch = htmlContent.match(/<style[^>]*>([\s\S]*?)<\/style>/gi);
    const styles = styleMatch ? styleMatch.join('\n') : '';

    // Extract the body content (everything between <body> and </body>)
    const bodyMatch = htmlContent.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
    const bodyContent = bodyMatch ? bodyMatch[1] : htmlContent;

    return (
      <>
        {/* Inject the extracted styles */}
        {styles && <div dangerouslySetInnerHTML={{ __html: styles }} />}
        {/* Render the body content */}
        <div dangerouslySetInnerHTML={{ __html: bodyContent }} className="atlas-content w-full" />
      </>
    );
  } catch (error) {
    console.error('Error fetching Atlas content:', error);
    return (
      <div className="flex min-h-[400px] flex-col items-center justify-center p-8 text-center">
        <h2 className="mb-2 text-xl font-semibold text-red-600">Failed to Load Atlas Content</h2>
        <p className="mb-4 text-gray-600">Unable to fetch the latest Atlas content from GitHub.</p>
        <p className="text-sm text-gray-500">{error instanceof Error ? error.message : 'Unknown error occurred'}</p>
      </div>
    );
  }
}

function LoadingFallback() {
  return (
    <div className="flex min-h-[400px] flex-col items-center justify-center p-8 text-center">
      <div className="mb-4 h-8 w-8 animate-spin rounded-full border-b-2 border-blue-600"></div>
      <h2 className="mb-2 text-lg font-medium text-gray-700">Loading Atlas Content</h2>
      <p className="text-gray-500">Fetching the latest version from GitHub...</p>
    </div>
  );
}

export default function GitHubAtlasPage() {
  return (
    <div className="ua-scope min-h-screen">
      <div className="container mx-auto">
        <Suspense fallback={<LoadingFallback />}>
          <AtlasContent />
        </Suspense>
      </div>
    </div>
  );
}

export const metadata = {
  title: 'Sky Atlas - GitHub Version',
  description: 'Live Sky Atlas content fetched directly from the GitHub repository',
};
