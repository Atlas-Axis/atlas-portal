'use server';

// import { revalidatePath } from 'next/cache';

// TODO: Fix runtime error: "Failed to revalidate path /atlas: Error: Invariant: static generation store missing in revalidatePath /atlas"
export async function revalidatePage(path: string) {
  console.log(`Revalidation requested for path: ${path}`); // TODO: Remove

  // try {
  // revalidatePath(path);
  // return { success: true, message: `Revalidation triggered for path: ${path}` };
  // } catch (error) {
  // console.error(`Failed to revalidate path ${path}:`, error);
  // return { success: false, message: `Failed to revalidate path: ${path}` };
  // }
}
