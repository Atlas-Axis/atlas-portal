'use server';

import { cookies } from 'next/headers';

const PASSWORD = 'CuQMNJ';
const COOKIE_NAME = 'CuQMNJ';
const COOKIE_VALUE = 'true';
const COOKIE_MAX_AGE = 60 * 60 * 24 * 90; // 90 days

/**
 * Authentication result types using discriminated union for type safety
 */
export type AuthenticationResult = { success: true } | { success: false; error: string };

/**
 * Checks if the user is authenticated by verifying the auth cookie
 */
export async function checkAuthentication(): Promise<boolean> {
  const cookieStore = await cookies();
  const authCookie = cookieStore.get(COOKIE_NAME);
  return authCookie?.value === COOKIE_VALUE;
}

/**
 * Authenticates the user by checking the password and setting the auth cookie
 */
export async function authenticateAction(password: string): Promise<AuthenticationResult> {
  if (password !== PASSWORD) {
    return { success: false, error: 'Invalid password' };
  }

  const cookieStore = await cookies();
  cookieStore.set(COOKIE_NAME, COOKIE_VALUE, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: COOKIE_MAX_AGE,
    path: '/',
  });

  return { success: true };
}
