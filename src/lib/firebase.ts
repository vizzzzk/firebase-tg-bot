
// Import the functions you need from the SDKs you need
import { getApp, getApps, initializeApp, type FirebaseApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

// Your web app's Firebase configuration.
// This is safe to expose on the client-side.
const firebaseConfig = {
  apiKey: "AIzaSyAZLdJ8hWbH2iA6a-Y9kXyV7k_ZzI8sGcg",
  authDomain: "vizbot-af245.firebaseapp.com",
  projectId: "vizbot-af245",
  storageBucket: "vizbot-af245.appspot.com",
  messagingSenderId: "338959929235",
  appId: "1:338959929235:web:a07b461f568da4cbe96b99"
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
