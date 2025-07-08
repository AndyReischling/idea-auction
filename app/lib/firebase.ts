import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth, Auth } from 'firebase/auth';
import { getFirestore, Firestore } from 'firebase/firestore';
import { getAnalytics, Analytics } from 'firebase/analytics';

const firebaseConfig = {
  apiKey: "AIzaSyA9_9vbw7jTunztB5almko8YGLvEAFMhBM",
  authDomain: "idea-auction.firebaseapp.com",
  projectId: "idea-auction",
  storageBucket: "idea-auction.firebasestorage.app",
  messagingSenderId: "883026956008",
  appId: "1:883026956008:web:592cb6387b0ca81bf4435d",
  measurementId: "G-78MY9HRLSF"
};

// Initialize Firebase
let app;
if (!getApps().length) {
  app = initializeApp(firebaseConfig);
} else {
  app = getApp();
}

// Initialize Firebase Authentication and get a reference to the service
export const auth: Auth = getAuth(app);

// Initialize Cloud Firestore and get a reference to the service
export const db: Firestore = getFirestore(app);

// Initialize Analytics (only in browser environment)
export const analytics: Analytics | null = typeof window !== 'undefined' ? getAnalytics(app) : null;

export default app; 