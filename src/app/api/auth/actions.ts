
'use server';

import { requestOtpFlow, verifyOtpFlow } from '@/ai/flows/auth-flow';
import { initAdminApp } from '@/lib/firebase-admin';
import { getAuth as getAdminAuth } from 'firebase-admin/auth';
import { getAuth, signInWithCustomToken } from 'firebase/auth';
import { getFirestore } from 'firebase-admin/firestore';
import { app } from '@/lib/firebase';


export async function requestOtp(email: string) {
  try {
    initAdminApp();
    const db = getFirestore();
    // 1. Call the flow to generate an OTP
    const flowResult = await requestOtpFlow({ email });

    if (!flowResult.success || !flowResult.otp) {
        return { success: false, message: flowResult.message || 'Failed to generate OTP.' };
    }
    
    // 2. Store the OTP in Firestore
    const otp = flowResult.otp;
    const expires = new Date(Date.now() + 10 * 60 * 1000); // OTP expires in 10 minutes

    const otpRef = db.collection('otps').doc(email);
    await otpRef.set({
      otp,
      expires,
      verified: false,
    });
    
    // In a real app, you would email the OTP here.
    console.log(`OTP for ${email}: ${otp}`);

    return {
      success: true,
      message: 'OTP generated and sent successfully.',
      otp: otp, // For development purposes ONLY
    };

  } catch (error: any) {
    console.error('Error requesting OTP:', error);
    return { success: false, message: error.message || 'An unknown error occurred.' };
  }
}

export async function verifyOtp(email: string, otp: string): Promise<{ success: boolean; message: string; customToken?: string }> {
  try {
     initAdminApp();
     const db = getFirestore();
     // 1. Verify the OTP against Firestore
    const otpRef = db.collection('otps').doc(email);
    const otpDoc = await otpRef.get();

    if (!otpDoc.exists) {
      return { success: false, message: 'No OTP request found for this email. Please request one first.' };
    }

    const data = otpDoc.data();
    if (!data) {
      return { success: false, message: 'Invalid OTP document.' };
    }
    
    const now = new Date();
    if (data.expires.toDate() < now) {
      await otpRef.delete(); // Clean up expired OTP
      return { success: false, message: 'OTP has expired. Please request a new one.' };
    }

    if (data.otp !== otp) {
      return { success: false, message: 'Invalid OTP.' };
    }
    
    // Mark OTP as verified to prevent reuse and delete it
    await otpRef.delete();

    // 2. OTP is valid, now create or get the user in Firebase Auth
    const adminAuth = getAdminAuth();
    let user;
    try {
        user = await adminAuth.getUserByEmail(email);
    } catch (error: any) {
        if (error.code === 'auth/user-not-found') {
            // Create a new user if they don't exist
            user = await adminAuth.createUser({ email, emailVerified: true });
        } else {
            throw error;
        }
    }
    
    // 3. Create a custom token for the user to sign in on the client
    const customToken = await adminAuth.createCustomToken(user.uid);
    
    // The client will use this token to sign in, which will be caught by the onAuthStateChanged listener.
    return { success: true, message: 'Login successful!', customToken };
    
  } catch (error: any) {
    console.error('Error verifying OTP and logging in:', error);
    return { success: false, message: error.message || 'An unknown error occurred during login.' };
  }
}
    