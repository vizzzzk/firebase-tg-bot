
'use server';
/**
 * @fileOverview An authentication agent for handling OTP generation and verification.
 * 
 * - requestOtpFlow: Generates and stores an OTP for a given email.
 * - verifyOtpFlow: Verifies a user-provided OTP against the stored one.
 */

import { ai } from '@/ai/genkit';
import { z } from 'zod';
import { getFirestore } from 'firebase-admin/firestore';
import { initAdminApp } from '@/lib/firebase-admin';

// Initialize Firebase Admin SDK
initAdminApp();
const db = getFirestore();

// ===== OTP Generation Flow =====

const OtpRequestSchema = z.object({
  email: z.string().email().describe('The email address to send the OTP to.'),
});

const OtpResponseSchema = z.object({
  success: z.boolean(),
  message: z.string(),
  otp: z.string().optional().describe("The generated OTP. Only for development/debugging."),
});

export const requestOtpFlow = ai.defineFlow(
  {
    name: 'requestOtpFlow',
    inputSchema: OtpRequestSchema,
    outputSchema: OtpResponseSchema,
  },
  async ({ email }) => {
    try {
      const otp = Math.floor(100000 + Math.random() * 900000).toString(); // 6-digit OTP
      const expires = new Date(Date.now() + 10 * 60 * 1000); // OTP expires in 10 minutes

      const otpRef = db.collection('otps').doc(email);
      await otpRef.set({
        otp,
        expires,
        verified: false,
      });

      // In a real app, you would email the OTP here using a service like SendGrid.
      // For this project, we'll return the OTP in the response for easy testing.
      console.log(`OTP for ${email}: ${otp}`);

      return {
        success: true,
        message: 'OTP generated successfully.',
        otp: otp, // For development purposes ONLY
      };
    } catch (error) {
      console.error("Error in requestOtpFlow:", error);
      return {
        success: false,
        message: 'Failed to generate OTP.',
      };
    }
  }
);


// ===== OTP Verification Flow =====

const VerifyOtpRequestSchema = z.object({
  email: z.string().email(),
  otp: z.string().length(6),
});

const VerifyOtpResponseSchema = z.object({
  success: z.boolean(),
  message: z.string(),
});


export const verifyOtpFlow = ai.defineFlow(
  {
    name: 'verifyOtpFlow',
    inputSchema: VerifyOtpRequestSchema,
    outputSchema: VerifyOtpResponseSchema,
  },
  async ({ email, otp }) => {
    try {
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
        return { success: false, message: 'OTP has expired. Please request a new one.' };
      }

      if (data.otp !== otp) {
        return { success: false, message: 'Invalid OTP.' };
      }
      
      // Mark OTP as verified to prevent reuse
      await otpRef.update({ verified: true });

      return { success: true, message: 'OTP verified successfully.' };

    } catch (error) {
      console.error("Error in verifyOtpFlow:", error);
      return { success: false, message: 'An internal error occurred during OTP verification.' };
    }
  }
);

    