
'use server';

import { requestOtpFlow, verifyOtpFlow } from '@/ai/flows/auth-flow';
import { initAdminApp } from '@/lib/firebase-admin';
import { getAuth as getAdminAuth } from 'firebase-admin/auth';
import { getAuth, signInWithCustomToken } from 'firebase/auth';
import { app } from '@/lib/firebase';

initAdminApp();

export async function requestOtp(email: string) {
  try {
    const result = await requestOtpFlow({ email });
    return result;
  } catch (error: any) {
    console.error('Error requesting OTP:', error);
    return { success: false, message: error.message || 'An unknown error occurred.' };
  }
}

export async function verifyOtp(email: string, otp: string): Promise<{ success: boolean; message: string; customToken?: string }> {
  try {
    const verificationResult = await verifyOtpFlow({ email, otp });
    
    if (!verificationResult.success) {
      return { success: false, message: verificationResult.message };
    }

    // OTP is valid, now create or get the user in Firebase Auth
    const adminAuth = getAdminAuth();
    let user;
    try {
        user = await adminAuth.getUserByEmail(email);
    } catch (error: any) {
        if (error.code === 'auth/user-not-found') {
            // Create a new user if they don't exist
            user = await adminAuth.createUser({ email });
        } else {
            throw error;
        }
    }
    
    // Create a custom token for the user to sign in on the client
    const customToken = await adminAuth.createCustomToken(user.uid);
    
    // This part is tricky as we can't directly sign in on the server and send back a cookie.
    // The client will need to use this token to sign in.
    // We'll return the token and let the client-side handle the sign-in.
    
    const clientAuth = getAuth(app);
    await signInWithCustomToken(clientAuth, customToken);

    return { success: true, message: 'Login successful!', customToken };
    
  } catch (error: any) {
    console.error('Error verifying OTP and logging in:', error);
    return { success: false, message: error.message || 'An unknown error occurred during login.' };
  }
}

    