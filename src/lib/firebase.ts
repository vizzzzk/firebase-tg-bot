// Import the functions you need from the SDKs you need
import { initializeApp, getApp, getApps, type FirebaseApp } from "firebase/app";

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyCNVzTY9CXY7J_qWPxivPK-EkZgKUcK6Ic",
  authDomain: "webot-scm5f.firebaseapp.com",
  projectId: "webot-scm5f",
  storageBucket: "webot-scm5f.appspot.com",
  messagingSenderId: "634655886203",
  appId: "1:634655886203:web:3313a4d57bce49d8ec8bde"
};

// Initialize Firebase
function getApp(): FirebaseApp {
    if (!getApps().length) {
        return initializeApp(firebaseConfig);
    } else {
        return getApps()[0];
    }
}

export { getApp };
