
// Import the functions you need from the SDKs you need
import { getApp, getApps, initializeApp, type FirebaseApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

// Your web app's Firebase configuration.
// This is safe to expose on the client-side.
const firebaseConfig = {
  "projectId": "webot-tg-bot",
  "appId": "1:188956668308:web:b267ca9ffe3619f4af5f81",
  "storageBucket": "webot-tg-bot.firebasestorage.app",
  "apiKey": "AIzaSyBQlN0aXZlVpPCIhMH_N8Z-zbdKf2PmeVw",
  "authDomain": "webot-tg-bot.firebaseapp.com",
  "measurementId": "",
  "messagingSenderId": "188956668308"
};


// Initialize Firebase for SSR and client-side, ensuring it only happens once.
const app: FirebaseApp = getApps().length ? getApp() : initializeApp(firebaseConfig);

const auth = getAuth(app);
const db = getFirestore(app);

export { app, auth, db };
