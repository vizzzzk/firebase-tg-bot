// Import the functions you need from the SDKs you need
import { getApp, getApps, initializeApp, type FirebaseApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

// Your web app's Firebase configuration.
// This is safe to expose on the client-side.
const firebaseConfig = {
  apiKey: "YOUR_API_KEY",
  authDomain: "vizbot-af245.firebaseapp.com",
  projectId: "vizbot-af245",
  storageBucket: "vizbot-af245.appspot.com",
  messagingSenderId: "1059993352788",
  appId: "1:1059993352788:web:394823ea91535a820c7cb9"
};


// Initialize Firebase for SSR and client-side, ensuring it only happens once.
const app: FirebaseApp = getApps().length ? getApp() : initializeApp(firebaseConfig);

const auth = getAuth(app);
const db = getFirestore(app);

export { app, auth, db };
