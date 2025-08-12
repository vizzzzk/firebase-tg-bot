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

let app: FirebaseApp;
let auth: ReturnType<typeof getAuth>;
let db: ReturnType<typeof getFirestore>;

// Check if the required environment variables are set.
// This prevents the app from crashing during build if they are missing.
if (firebaseConfig.apiKey) {
    app = getApps().length ? getApp() : initializeApp(firebaseConfig);
    auth = getAuth(app);
    db = getFirestore(app);
} else {
    console.error("Firebase config is missing. Client-side Firebase features will be disabled.");
    // In a server-side build environment, we might want to throw to prevent a broken deployment.
    if (process.env.NODE_ENV === 'production' && typeof window === 'undefined') {
        throw new Error("CRITICAL: NEXT_PUBLIC_FIREBASE_API_KEY is not defined. Build failed.");
    }
    // Provide dummy objects for the browser to avoid reference errors.
    app = {} as FirebaseApp;
    auth = {} as ReturnType<typeof getAuth>;
    db = {} as ReturnType<typeof getFirestore>;
}


export { app, auth, db };
