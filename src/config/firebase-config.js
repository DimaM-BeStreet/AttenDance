import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getFunctions } from 'firebase/functions';
import { getStorage } from 'firebase/storage';
import { getAnalytics } from 'firebase/analytics';

// Firebase configuration from environment variables
const firebaseConfig = {
  apiKey: process.env.FIREBASE_API_KEY,
  authDomain: process.env.FIREBASE_AUTH_DOMAIN,
  projectId: process.env.FIREBASE_PROJECT_ID,
  storageBucket: process.env.FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.FIREBASE_APP_ID,
  measurementId: process.env.FIREBASE_MEASUREMENT_ID
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Firebase services
const auth = getAuth(app);
const db = getFirestore(app);
const functions = getFunctions(app);
const storage = getStorage(app);
const analytics = getAnalytics(app);

// Suppress Google Identity Services iframe errors (harmless timing issue)
window.addEventListener('error', function(e) {
  if (e.filename && e.message && 
      (e.filename.includes('api.js') || e.filename.includes('gapi')) &&
      e.message.includes('is not a function')) {
    e.stopImmediatePropagation();
    e.preventDefault();
    return true;
  }
}, true);

// Export services
export { app, auth, db, functions, storage, analytics };
