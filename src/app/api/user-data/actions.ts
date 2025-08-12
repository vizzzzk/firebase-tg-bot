
"use server";

import { getApp } from '@/lib/firebase';
import { doc, getDoc, setDoc, updateDoc, getFirestore } from 'firebase/firestore';
import type { Portfolio } from '@/lib/bot-logic';

const db = getFirestore(getApp());

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
      console.log('No such document for user:', userId);
      return null; // No document found for this user
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
    const docSnap = await getDoc(userDocRef);

    if (docSnap.exists()) {
      // Document exists, update it
      await updateDoc(userDocRef, data);
    } else {
      // Document does not exist, create it
      await setDoc(userDocRef, data);
    }
  } catch (error) {
    console.error('Error updating user data in Firestore:', error);
    // Don't throw error to the client, just log it.
  }
}
