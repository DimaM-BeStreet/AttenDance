import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getFunctions } from 'firebase/functions';
import { getStorage } from 'firebase/storage';
import { getAnalytics } from 'firebase/analytics';

// Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyDpTB1TyESJLjZ9Uw2gtjJA04bgjvIF86I",
  authDomain: "attendance-6e07e.firebaseapp.com",
  projectId: "attendance-6e07e",
  storageBucket: "attendance-6e07e.firebasestorage.app",
  messagingSenderId: "268301291600",
  appId: "1:268301291600:web:8cb90147f89ce4b85d8155",
  measurementId: "G-9RVDZP5VTP"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Firebase services
const auth = getAuth(app);
const db = getFirestore(app);
const functions = getFunctions(app);
const storage = getStorage(app);
const analytics = getAnalytics(app);

// Export services
export { app, auth, db, functions, storage, analytics };
