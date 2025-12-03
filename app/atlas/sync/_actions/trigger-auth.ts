'use server';

import { auth } from '@trigger.dev/sdk/v3';

/**
 * Creates a public access token for subscribing to a specific run.
 * This token is read-only and scoped to the specific run ID.
 *
 * @param runId The Trigger.dev run ID to create a token for
 * @returns Object with token or error
 */
export async function createPublicAccessToken(runId: string): Promise<{ token: string } | { error: string }> {
  try {
    const publicToken = await auth.createPublicToken({
      scopes: {
        read: {
          runs: [runId],
        },
      },
      expirationTime: '6h', // Match the max task duration
    });

    return { token: publicToken };
  } catch (error) {
    const err = error as Error;
    console.error('Failed to create public access token:', err);
    return { error: err.message || 'Failed to create access token' };
  }
}
