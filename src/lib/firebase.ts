
// Import the functions you need from the SDKs you need
import { getApp, getApps, initializeApp, type FirebaseApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

// Your web app's Firebase configuration.
// This is safe to expose on the client-side.
const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

// Initialize Firebase for SSR
let app: FirebaseApp;

// This function ensures we initialize the app only once.
function getFirebaseApp() {
    if (getApps().length > 0) {
        return getApp();
    }
    
    // Check if the config keys are present. This is a safeguard.
    if (!firebaseConfig.apiKey || !firebaseConfig.projectId) {
        // In a real production environment, you might want to log this error
        // to a service like Sentry or Google Cloud Logging.
        // For this context, we will throw an error to make it visible during development.
        throw new Error('Firebase configuration is missing. Make sure to set NEXT_PUBLIC_FIREBASE_API_KEY and other required variables.');
    }

    return initializeApp(firebaseConfig);
}

app = getFirebaseApp();

const auth = getAuth(app);
const db = getFirestore(app);

export { app, auth, db };
