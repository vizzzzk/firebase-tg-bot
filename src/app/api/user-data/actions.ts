
"use server";

import { initAdminApp } from '@/lib/firebase-admin';
import { getFirestore as getAdminFirestore } from 'firebase-admin/firestore';
import type { Portfolio } from '@/lib/bot-logic';

interface UserData {
  accessToken?: string | null;
  portfolio?: Portfolio;
  displayName?: string;
  [key: string]: any;
}

// Function to get user data from Firestore using the Admin SDK.
// It now returns a structured object to indicate success or failure.
export async function getUserData(userId: string): Promise<{success: boolean, data?: UserData | null, error?: string}> {
  if (!userId) return { success: true, data: null };
  try {
    initAdminApp();
    const adminDb = getAdminFirestore();
    const userDocRef = adminDb.collection('users').doc(userId);
    const docSnap = await userDocRef.get();

    if (docSnap.exists) {
      return { success: true, data: docSnap.data() as UserData };
    } else {
      // It's normal for a new user's doc to not exist yet.
      return { success: true, data: null };
    }
  } catch (error: any) {
    console.error('Error fetching user data from Firestore:', error);
    // Return a structured error object instead of throwing.
    return { success: false, error: error.message || 'Failed to fetch user data. Please check Firestore permissions.' };
  }
}

// Function to update or create user data in Firestore using the Admin SDK.
// It now returns a structured object to indicate success or failure.
export async function updateUserData(userId: string, data: UserData): Promise<{success: boolean, error?: string}> {
   if (!userId) return {success: true}; // Or return an error if userId is essential
  try {
    initAdminApp();
    const adminDb = getAdminFirestore();
    const userDocRef = adminDb.collection('users').doc(userId);
    // Use set with merge:true to create or update the document atomically.
    await userDocRef.set(data, { merge: true });
    return { success: true };
  } catch (error: any) {
    console.error('Error updating user data in Firestore:', error);
    // Return a structured error object.
    return { success: false, error: error.message || 'Failed to update user data.' };
  }
}
