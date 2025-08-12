
'use server';

import { initAdminApp } from '@/lib/firebase-admin';
import { getAuth as getAdminAuth } from 'firebase-admin/auth';

// This function is not used in the new email/password flow but is kept
// as a reference for creating custom tokens if needed in the future.
export async function createCustomToken(uid: string): Promise<string> {
    initAdminApp();
    const adminAuth = getAdminAuth();
    const customToken = await adminAuth.createCustomToken(uid);
    return customToken;
}
