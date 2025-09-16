'use server';

import { revalidatePath } from 'next/cache';

export async function revalidatePage(path: string) {
  try {
    revalidatePath(path);
    return { success: true, message: `Revalidation triggered for path: ${path}` };
  } catch (error) {
    console.error(`Failed to revalidate path ${path}:`, error);
    return { success: false, message: `Failed to revalidate path: ${path}` };
  }
}
