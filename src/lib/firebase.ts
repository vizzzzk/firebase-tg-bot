// Import the functions you need from the SDKs you need
import { getApp, getApps, initializeApp, type FirebaseApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyCNVzTY9CXY7J_qWPxivPK-EkZgKUcK6Ic",
  authDomain: "webot-scm5f.firebaseapp.com",
  projectId: "webot-scm5f",
  storageBucket: "webot-scm5f.appspot.com",
  messagingSenderId: "634655886203",
  appId: "1:634655886203:web:3313a4d57bce49d8ec8bde"
};


// Initialize Firebase for SSR
const app: FirebaseApp = !getApps().length ? initializeApp(firebaseConfig) : getApp();
const auth = getAuth(app);
const db = getFirestore(app);

export { app, auth, db };
