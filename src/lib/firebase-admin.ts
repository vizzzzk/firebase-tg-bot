import * as admin from 'firebase-admin';

export const initAdminApp = () => {
    if (admin.apps.length > 0) {
        return admin.app();
    }

    const serviceAccount = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;

    if (!serviceAccount) {
        throw new Error('FIREBASE_SERVICE_ACCOUNT_KEY environment variable is not set. The server cannot authenticate for administrative tasks.');
    }

    try {
        const parsedServiceAccount = JSON.parse(serviceAccount);
        admin.initializeApp({
            credential: admin.credential.cert(parsedServiceAccount),
        });
    } catch (e: any) {
        console.error("Failed to parse or use FIREBASE_SERVICE_ACCOUNT_KEY:", e.message);
        throw new Error("Could not initialize Firebase Admin SDK. The service account key may be invalid.");
    }
    
    return admin.app();
};
