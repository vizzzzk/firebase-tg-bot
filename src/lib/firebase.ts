
// Import the functions you need from the SDKs you need
import { getApp, getApps, initializeApp, type FirebaseApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

// Your web app's Firebase configuration.
// This is safe to expose on the client-side.
// Hardcoded to prevent environment variable loading issues in production.
const firebaseConfig = {
  apiKey: "AIzaSyCNVzTY9CXY7J_qWPxivPK-EkZgKUcK6Ic",
  authDomain: "webot-scm5f.firebaseapp.com",
  projectId: "webot-scm5f",
  storageBucket: "webot-scm5f.appspot.com",
  messagingSenderId: "634655886203",
  appId: "1:634655886203:web:3313a4d57bce49d8ec8bde",
};

// Initialize Firebase for SSR
let app: FirebaseApp;

// This function ensures we initialize the app only once.
function getFirebaseApp() {
    if (getApps().length > 0) {
        return getApp();
    }
    
    // The error was being thrown here. By removing the check,
    // we allow Firebase to initialize with the runtime environment variables.
    // The Firebase SDK has its own checks for missing keys.
    return initializeApp(firebaseConfig);
}

app = getFirebaseApp();

const auth = getAuth(app);
const db = getFirestore(app);

export { app, auth, db };
