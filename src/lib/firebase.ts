
// Import the functions you need from the SDKs you need
import { getApp, getApps, initializeApp, type FirebaseApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

// Your web app's Firebase configuration.
// This is safe to expose on the client-side.
// Hardcoding these values to prevent build-time environment variable issues.
const firebaseConfig = {
  apiKey: "AIzaSyAZLdJ8hWbH2iA6a-Y9kXyV7k_ZzI8sGcg",
  authDomain: "vizbot-af245.firebaseapp.com",
  projectId: "vizbot-af245",
  storageBucket: "vizbot-af245.appspot.com",
  messagingSenderId: "338959929235",
  appId: "1:338959929235:web:a07b461f568da4cbe96b99"
};


// Initialize Firebase for SSR and client-side, ensuring it only happens once.
const app: FirebaseApp = getApps().length ? getApp() : initializeApp(firebaseConfig);

const auth = getAuth(app);
const db = getFirestore(app);

export { app, auth, db };
