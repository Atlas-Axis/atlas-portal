import { Suspense } from 'react';
import { ATLAS_GITHUB_REPO_URL } from '../server/services/atlas/constants';
import './styles.css';

// Cache for 10 seconds
const CACHE_SECONDS = 10;

async function AtlasContent() {
  try {
    const response = await fetch(ATLAS_GITHUB_REPO_URL, {
      next: { revalidate: CACHE_SECONDS },
    });

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
        <div dangerouslySetInnerHTML={{ __html: bodyContent }} style={{ width: '100%' }} />
      </>
    );
  } catch (error) {
    console.error('Error fetching Atlas content:', error);
    return (
      <div
        style={{
          display: 'flex',
          minHeight: '400px',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '2rem',
          textAlign: 'center',
        }}
      >
        <h2
          style={{
            marginBottom: '0.5rem',
            fontSize: '1.25rem',
            fontWeight: '600',
            color: '#dc2626',
          }}
        >
          Failed to Load Atlas Content
        </h2>
        <p
          style={{
            marginBottom: '1rem',
            color: '#4b5563',
          }}
        >
          Unable to fetch the latest Atlas content from GitHub.
        </p>
        <p
          style={{
            fontSize: '0.875rem',
            color: '#6b7280',
          }}
        >
          {error instanceof Error ? error.message : 'Unknown error occurred'}
        </p>
      </div>
    );
  }
}

function LoadingFallback() {
  return (
    <div
      style={{
        display: 'flex',
        minHeight: '400px',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '2rem',
        textAlign: 'center',
      }}
    >
      <div
        style={{
          marginBottom: '1rem',
          height: '2rem',
          width: '2rem',
          border: '2px solid transparent',
          borderTop: '2px solid #2563eb',
          borderRadius: '50%',
          animation: 'spin 1s linear infinite',
        }}
      ></div>
      <h2
        style={{
          marginBottom: '0.5rem',
          fontSize: '1.125rem',
          fontWeight: '500',
          color: '#374151',
        }}
      >
        Loading Atlas Content
      </h2>
      <p style={{ color: '#6b7280' }}>Fetching the latest version from GitHub...</p>
    </div>
  );
}

export default function GitHubAtlasPage() {
  return (
    <>
      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
      <div className="ua-scope">
        <div>
          <Suspense fallback={<LoadingFallback />}>
            <AtlasContent />
          </Suspense>
        </div>
      </div>
    </>
  );
}

export const metadata = {
  title: 'Sky Atlas - GitHub Version',
  description: 'Live Sky Atlas content fetched directly from the GitHub repository',
};
