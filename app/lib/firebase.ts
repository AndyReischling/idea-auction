import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth, Auth } from 'firebase/auth';
import { getFirestore, Firestore, enableNetwork, disableNetwork } from 'firebase/firestore';
import { getAnalytics, Analytics } from 'firebase/analytics';

// Firebase configuration
// NOTE: Email link authentication must be enabled in Firebase Console:
// Authentication > Sign-in method > Email link (passwordless sign-in)
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

// Add network resilience for connection issues
if (typeof window !== 'undefined') {
  // Monitor online/offline status
  window.addEventListener('online', () => {
    console.log('🌐 Network back online - re-enabling Firestore');
    enableNetwork(db);
  });
  
  window.addEventListener('offline', () => {
    console.log('📴 Network offline - Firestore will use cache');
    // Don't disable network here - let Firestore handle it automatically
  });

  // Handle unhandled promise rejections (common with network errors)
  window.addEventListener('unhandledrejection', (event) => {
    if (event.reason?.message?.includes('firestore') || 
        event.reason?.message?.includes('QUIC') ||
        event.reason?.message?.includes('ERR_NETWORK')) {
      console.warn('🔧 Firestore network error handled:', event.reason.message);
      // Don't show error to user for network issues
      event.preventDefault();
    }
  });
}

// Initialize Analytics (only in browser environment)
export const analytics: Analytics | null = typeof window !== 'undefined' ? getAnalytics(app) : null;

export default app; 