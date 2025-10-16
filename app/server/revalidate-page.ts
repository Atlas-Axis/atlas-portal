'use server';

/**
 * Revalidates a Next.js page path by making an HTTP request to the internal revalidation API.
 * This allows revalidation to work from contexts outside of Next.js (e.g., Trigger.dev tasks, CLI scripts).
 *
 * @param path - The path to revalidate (e.g., '/atlas')
 * @returns Promise with success status and message
 */
export async function revalidatePage(path: string): Promise<{ success: boolean; message: string }> {
  try {
    // Determine base URL based on environment
    const baseUrl = getBaseUrl();
    const revalidateUrl = `${baseUrl}/api/revalidate`;

    console.log(`🔄 Revalidating path: ${path} via ${revalidateUrl}`);

    // Make POST request to internal revalidation API
    const response = await fetch(revalidateUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ path }),
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || `HTTP ${response.status}: ${response.statusText}`);
    }

    console.log(`✅ Successfully revalidated path: ${path}`);
    return {
      success: true,
      message: data.message || `Revalidation triggered for path: ${path}`,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    console.error(`❌ Failed to revalidate path ${path}:`, errorMessage);

    return {
      success: false,
      message: `Failed to revalidate path: ${path}. Error: ${errorMessage}`,
    };
  }
}

/**
 * Determines the base URL for internal API calls based on the environment.
 */
function getBaseUrl(): string {
  // Production: Use BASE_URL
  if (process.env.BASE_URL) {
    return `https://${process.env.BASE_URL}`;
  }

  throw new Error('Could not determine base URL');
}
