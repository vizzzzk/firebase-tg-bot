
"use server";

import { db } from '@/lib/firebase';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import type { Portfolio } from '@/lib/bot-logic';

interface UserData {
  accessToken?: string | null;
  portfolio?: Portfolio;
}

// Function to get user data from Firestore.
// It is tolerant and returns null if the document doesn't exist, instead of throwing.
export async function getUserData(userId: string): Promise<(UserData & { [key: string]: any }) | null> {
  if (!userId) return null;
  try {
    const userDocRef = doc(db, 'users', userId);
    const docSnap = await getDoc(userDocRef);

    if (docSnap.exists()) {
      return docSnap.data() as UserData;
    } else {
      // It's normal for a new user's doc to not exist yet.
      // The caller is responsible for handling this case (e.g., by using default data).
      return null;
    }
  } catch (error) {
    console.error('Error fetching user data from Firestore:', error);
    throw new Error('Could not fetch user data.');
  }
}

// Function to update or create user data in Firestore.
// Uses set with merge:true to handle both creation and updates atomically.
export async function updateUserData(userId: string, data: UserData): Promise<void> {
   if (!userId) return;
  try {
    const userDocRef = doc(db, 'users', userId);
    // Use set with merge:true to create or update the document atomically.
    // This is safer and more robust than checking for existence first.
    await setDoc(userDocRef, data, { merge: true });
  } catch (error) {
    console.error('Error updating user data in Firestore:', error);
    // Avoid throwing to the client for background updates; just log the error.
  }
}
