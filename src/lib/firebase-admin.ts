
import * as admin from 'firebase-admin';

const serviceAccount = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;

if (!serviceAccount) {
    throw new Error('FIREBASE_SERVICE_ACCOUNT_KEY environment variable is not set.');
}

const parsedServiceAccount = JSON.parse(serviceAccount);

export const initAdminApp = () => {
    if (admin.apps.length === 0) {
        admin.initializeApp({
            credential: admin.credential.cert(parsedServiceAccount),
        });
    }
    return admin.app();
};

    