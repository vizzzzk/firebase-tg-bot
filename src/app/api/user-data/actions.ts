
"use server";

import { db } from '@/lib/firebase';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import type { Portfolio } from '@/lib/bot-logic';

interface UserData {
  accessToken?: string | null;
  portfolio?: Portfolio;
}

// Function to get user data from Firestore
export async function getUserData(userId: string): Promise<UserData | null> {
  if (!userId) return null;
  try {
    const userDocRef = doc(db, 'users', userId);
    const docSnap = await getDoc(userDocRef);

    if (docSnap.exists()) {
      return docSnap.data() as UserData;
    } else {
      // It's normal for a new user to not have a document yet.
      return null;
    }
  } catch (error) {
    console.error('Error fetching user data from Firestore:', error);
    throw new Error('Could not fetch user data.');
  }
}

// Function to update or create user data in Firestore
export async function updateUserData(userId: string, data: UserData): Promise<void> {
   if (!userId) return;
  try {
    const userDocRef = doc(db, 'users', userId);
    // Use set with merge:true to create or update the document atomically.
    await setDoc(userDocRef, data, { merge: true });
  } catch (error) {
    console.error('Error updating user data in Firestore:', error);
    // Don't throw error to the client, just log it.
  }
}
