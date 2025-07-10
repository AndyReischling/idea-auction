'use client';

import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { 
  User, 
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  onAuthStateChanged, 
  signOut,
  AuthError,
  setPersistence,
  browserLocalPersistence
} from 'firebase/auth';
import { 
  doc, 
  getDoc, 
  setDoc, 
  serverTimestamp, 
  query, 
  where, 
  getDocs, 
  collection,
  updateDoc
} from 'firebase/firestore';
import { auth, db } from './firebase';
import { dataReconciliationService } from './data-reconciliation';
import { marketDataSyncService } from './market-data-sync';

interface UserProfile {
  uid: string;
  email: string;
  username: string;
  balance: number;
  joinDate: any;
  totalEarnings: number;
  totalLosses: number;
  preferences: {
    theme: 'light' | 'dark';
    notifications: boolean;
  };
  createdAt: any;
  updatedAt: any;
}

interface AuthContextType {
  user: User | null;
  userProfile: UserProfile | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string, username: string) => Promise<void>;
  logout: () => Promise<void>;
  updateProfile: (updates: Partial<UserProfile>) => Promise<void>;
  checkUsernameAvailability: (username: string) => Promise<boolean>;
  testFirestoreConnection: () => Promise<boolean>;
  forceSyncToFirebase: () => Promise<{ success: boolean; message: string }>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  // Initialize Firebase Auth persistence on component mount
  useEffect(() => {
    const initializeAuth = async () => {
      try {
        // Set persistence to LOCAL to ensure users stay logged in across browser sessions
        // This means users will only log out when they explicitly click the logout button
        await setPersistence(auth, browserLocalPersistence);
        console.log('✅ Firebase Auth persistence set to LOCAL - users will stay logged in until explicit logout');
      } catch (error) {
        console.error('❌ Failed to set Firebase Auth persistence:', error);
        // Continue anyway - Firebase will use default persistence
      }
    };

    initializeAuth();
  }, []);

  // Load user profile with retry logic
  const loadUserProfile = async (user: User): Promise<UserProfile | null> => {
    try {
      console.log('👤 Loading user profile for:', user.email);
      const startTime = Date.now();
      
      const userDoc = await getDoc(doc(db, 'users', user.uid));
      const endTime = Date.now();
      
      if (userDoc.exists()) {
        console.log(`✅ User profile loaded successfully in ${endTime - startTime}ms`);
        return userDoc.data() as UserProfile;
      } else {
        console.log(`⚠️ No profile found for user in ${endTime - startTime}ms`);
        return null;
      }
    } catch (error) {
      console.error('❌ Error loading user profile:', error);
      
      // Check if it's a connection issue
      if (error instanceof Error && error.message.includes('offline')) {
        console.warn('🌐 Firestore is offline, user profile will be loaded when connection is restored');
        return null;
      }
      
      // For other errors, still return null but log the error
      return null;
    }
  };

  // Create user profile with better error handling and performance
  const createUserProfile = async (user: User, username: string): Promise<UserProfile> => {
    console.log('📝 Creating user profile for:', user.email);
    const startTime = Date.now();
    
    const userProfile: UserProfile = {
      uid: user.uid,
      email: user.email || '',
      username,
      balance: 10000,
      joinDate: serverTimestamp(),
      totalEarnings: 0,
      totalLosses: 0,
      preferences: {
        theme: 'light',
        notifications: true,
      },
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };

    try {
      // Create both documents in parallel for better performance
      console.log('💾 Saving user profile and username reservation...');
      
      const userDocPromise = setDoc(doc(db, 'users', user.uid), userProfile);
      const usernameDocPromise = setDoc(doc(db, 'usernames', username.toLowerCase()), {
        uid: user.uid,
        reserved: true,
        createdAt: serverTimestamp(),
      });

      // Wait for both operations to complete
      await Promise.all([userDocPromise, usernameDocPromise]);
      
      const endTime = Date.now();
      console.log(`✅ User profile created successfully in ${endTime - startTime}ms`);

      return userProfile;
    } catch (error) {
      const endTime = Date.now();
      console.error(`❌ Profile creation failed after ${endTime - startTime}ms:`, error);
      
      // If Firestore is offline, return the profile anyway
      // It will be synced when connection is restored
      if (error instanceof Error && error.message.includes('offline')) {
        console.warn('🌐 Firestore is offline, profile will be synced when connection is restored');
        return userProfile;
      }
      
      throw new Error('Failed to create user profile. Please try again.');
    }
  };

  // Check if username is available
  const checkUsernameAvailability = async (username: string): Promise<boolean> => {
    try {
      console.log('🔍 Checking username availability for:', username);
      const usernameDoc = await getDoc(doc(db, 'usernames', username.toLowerCase()));
      const exists = usernameDoc.exists();
      console.log('📝 Username exists:', exists);
      return !exists; // Return true if username is available (doesn't exist)
    } catch (error) {
      console.error('❌ Error checking username availability:', error);
      
      // If it's a permission denied error, the collection might not exist yet
      if (error instanceof Error && error.message.includes('PERMISSION_DENIED')) {
        console.warn('🔒 Permission denied accessing usernames collection - assuming username is available');
        return true; // Assume available if we can't check due to permissions
      }
      
      // If offline, assume username is available (will be checked again when online)
      if (error instanceof Error && error.message.includes('offline')) {
        console.warn('🌐 Firestore is offline, username availability will be checked when connection is restored');
        return true;
      }
      
      // If collection doesn't exist, assume username is available
      if (error instanceof Error && (error.message.includes('NOT_FOUND') || error.message.includes('not found'))) {
        console.warn('📂 Usernames collection not found - assuming username is available');
        return true;
      }
      
      // For other errors, be optimistic and assume username is available
      // This prevents blocking all username registrations due to technical issues
      console.warn('⚠️ Unknown error checking username - assuming available:', error);
      return true;
    }
  };

  // Authentication functions
  const signIn = async (email: string, password: string): Promise<void> => {
    try {
      console.log('🔐 Starting sign in process...');
      const startTime = Date.now();
      
      await signInWithEmailAndPassword(auth, email, password);
      
      const endTime = Date.now();
      console.log(`✅ User signed in successfully in ${endTime - startTime}ms`);
    } catch (error) {
      const authError = error as AuthError;
      console.error('❌ Sign in error:', authError);
      
      // Provide user-friendly error messages
      let errorMessage = 'Failed to sign in. Please try again.';
      
      switch (authError.code) {
        case 'auth/invalid-email':
          errorMessage = 'Please enter a valid email address.';
          break;
        case 'auth/user-not-found':
          errorMessage = 'User not found. Please check your email and password.';
          break;
        case 'auth/wrong-password':
          errorMessage = 'Incorrect password. Please try again.';
          break;
        case 'auth/network-request-failed':
          errorMessage = 'Network error. Please check your connection and try again.';
          break;
        case 'auth/too-many-requests':
          errorMessage = 'Too many failed attempts. Please wait a moment before trying again.';
          break;
        default:
          errorMessage = authError.message || 'An unexpected error occurred.';
      }
      
      throw new Error(errorMessage);
    }
  };

  const signUp = async (email: string, password: string, username: string): Promise<void> => {
    try {
      console.log('🚀 Starting sign up process...');
      
      // Step 1: Check username availability (fast operation)
      console.log('1️⃣ Checking username availability...');
      const isUsernameAvailable = await checkUsernameAvailability(username);
      if (!isUsernameAvailable) {
        throw new Error('Username is already taken. Please choose another one.');
      }
      console.log('✅ Username is available');

      // Step 2: Create Firebase user account
      console.log('2️⃣ Creating Firebase user account...');
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      console.log('✅ Firebase user created:', userCredential.user.email);
      
      // Step 3: Create user profile (optimized with parallel operations)
      console.log('3️⃣ Creating user profile...');
      await createUserProfile(userCredential.user, username);
      
      console.log('✅ Sign up completed successfully');
      
    } catch (error) {
      const authError = error as AuthError;
      console.error('❌ Sign up error:', authError);
      
      // Provide user-friendly error messages
      let errorMessage = 'Failed to sign up. Please try again.';
      
      switch (authError.code) {
        case 'auth/email-already-in-use':
          errorMessage = 'This email address is already in use. Please choose another one.';
          break;
        case 'auth/invalid-email':
          errorMessage = 'Please enter a valid email address.';
          break;
        case 'auth/weak-password':
          errorMessage = 'Password should be at least 6 characters.';
          break;
        case 'auth/network-request-failed':
          errorMessage = 'Network error. Please check your connection and try again.';
          break;
        case 'auth/too-many-requests':
          errorMessage = 'Too many failed attempts. Please wait a moment before trying again.';
          break;
        default:
          errorMessage = authError.message || 'An unexpected error occurred.';
      }
      
      throw new Error(errorMessage);
    }
  };

  const logout = async (): Promise<void> => {
    try {
      console.log('🚪 EXPLICIT LOGOUT: User clicked logout button');
      console.log('👤 Logging out user:', user?.email);
      
      // Clear user profile first
      setUserProfile(null);
      
      // Stop market data sync
      marketDataSyncService.stopRealtimeSync();
      
      // Sign out from Firebase Auth
      await signOut(auth);
      
      console.log('✅ User logged out successfully - logout was EXPLICIT (button click)');
      console.log('🔒 Session will remain cleared until user explicitly signs in again');
    } catch (error) {
      const authError = error as AuthError;
      console.error('❌ Logout error:', authError);
      throw new Error(authError.message);
    }
  };

  const updateProfile = async (updates: Partial<UserProfile>): Promise<void> => {
    if (!user || !userProfile) {
      throw new Error('User not authenticated');
    }

    try {
      const updatedProfile = {
        ...userProfile,
        ...updates,
        updatedAt: new Date().toISOString(),
      };

      await setDoc(doc(db, 'users', user.uid), {
        ...updatedProfile,
        updatedAt: serverTimestamp(),
      }, { merge: true });
      setUserProfile(updatedProfile);
    } catch (error) {
      console.error('Error updating profile:', error);
      throw new Error('Failed to update profile');
    }
  };

  // Enhanced Firestore Connection Test
  const testFirestoreConnection = async (): Promise<boolean> => {
    try {
      console.log('🔍 Testing Firestore connection...');
      console.log('📊 Project ID:', db.app.options.projectId);
      console.log('🔑 API Key:', db.app.options.apiKey?.substring(0, 20) + '...');
      
      // Test 1: Try to read a simple document
      console.log('📝 Test 1: Reading test document...');
      const testDoc = doc(db, 'test', 'connection');
      const docSnap = await getDoc(testDoc);
      console.log('✅ Test 1 passed: Document read successful');
      
      // Test 2: Try to write a simple document (will fail if rules are restrictive)
      console.log('📝 Test 2: Writing test document...');
      await setDoc(testDoc, { 
        timestamp: new Date().toISOString(),
        test: 'connection'
      });
      console.log('✅ Test 2 passed: Document write successful');
      
      console.log('✅ All Firestore tests passed!');
      return true;
    } catch (error) {
      console.error('❌ Firestore connection test failed:', error);
      
      if (error instanceof Error) {
        console.error('Error name:', error.name);
        console.error('Error message:', error.message);
        
        // Provide specific guidance based on error type
        if (error.message.includes('PERMISSION_DENIED')) {
          console.error('🔒 ISSUE: Firestore security rules are blocking access');
          console.error('🔧 FIX: Update your Firestore security rules to allow read/write access');
        } else if (error.message.includes('NOT_FOUND')) {
          console.error('📂 ISSUE: Firestore database not found');
          console.error('🔧 FIX: Create a Firestore database in Firebase Console');
        } else if (error.message.includes('FAILED_PRECONDITION')) {
          console.error('⚙️ ISSUE: Firestore not properly configured');
          console.error('🔧 FIX: Enable Firestore in Firebase Console');
        } else {
          console.error('🔧 GENERAL FIX: Check Firebase Console for project setup');
        }
      }
      
      return false;
    }
  };

  // Force immediate sync from localStorage to Firebase
  const forceBalanceSync = async (user: User): Promise<void> => {
    if (!user?.uid) return;
    
    try {
      console.log('🔄 Force syncing localStorage balance to Firebase...');
      
      // Get current localStorage profile
      const storedProfile = localStorage.getItem('userProfile');
      if (!storedProfile) {
        console.log('⚠️ No localStorage profile found to sync');
        return;
      }
      
      const localProfile = JSON.parse(storedProfile);
      
      // Get current Firebase profile
      const firebaseDoc = await getDoc(doc(db, 'users', user.uid));
      if (!firebaseDoc.exists()) {
        console.log('⚠️ No Firebase profile found - creating new one');
        await setDoc(doc(db, 'users', user.uid), {
          ...localProfile,
          uid: user.uid,
          email: user.email,
          balance: Number(localProfile.balance) || 10000,
          totalEarnings: Number(localProfile.totalEarnings) || 0,
          totalLosses: Number(localProfile.totalLosses) || 0,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        });
        console.log('✅ Firebase profile created from localStorage');
        return;
      }
      
      const firebaseProfile = firebaseDoc.data();
      
      // Check if sync is needed
      const localBalance = Number(localProfile.balance) || 10000;
      const firebaseBalance = Number(firebaseProfile.balance) || 10000;
      const localEarnings = Number(localProfile.totalEarnings) || 0;
      const firebaseEarnings = Number(firebaseProfile.totalEarnings) || 0;
      const localLosses = Number(localProfile.totalLosses) || 0;
      const firebaseLosses = Number(firebaseProfile.totalLosses) || 0;
      
      if (localBalance !== firebaseBalance || localEarnings !== firebaseEarnings || localLosses !== firebaseLosses) {
        console.log('🔄 Syncing localStorage to Firebase:');
        console.log(`  Balance: ${firebaseBalance} → ${localBalance}`);
        console.log(`  Earnings: ${firebaseEarnings} → ${localEarnings}`);
        console.log(`  Losses: ${firebaseLosses} → ${localLosses}`);
        
        await updateDoc(doc(db, 'users', user.uid), {
          balance: localBalance,
          totalEarnings: localEarnings,
          totalLosses: localLosses,
          updatedAt: serverTimestamp()
        });
        
        console.log('✅ Firebase profile updated with localStorage data');
      } else {
        console.log('✅ No sync needed - data is already consistent');
      }
      
    } catch (error) {
      console.error('❌ Force balance sync failed:', error);
    }
  };

  // Manual sync function for users to force sync localStorage to Firebase
  const forceSyncToFirebase = async (): Promise<{ success: boolean; message: string }> => {
    if (!user?.uid) {
      return { success: false, message: 'No authenticated user found' };
    }
    
    try {
      await forceBalanceSync(user);
      return { success: true, message: 'Successfully synced localStorage data to Firebase' };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      return { success: false, message: `Sync failed: ${errorMessage}` };
    }
  };

  // Monitor authentication state with performance optimization
  useEffect(() => {
    console.log('🔄 Setting up auth state listener...');
    console.log('🔒 Auth persistence is set to LOCAL - users will stay logged in until explicit logout');
    
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      console.log('🔔 Auth state changed:', user ? `User: ${user.email}` : 'No user (logout or initial state)');
      
      // Important: This listener should NEVER trigger logout - it only responds to auth state changes
      // Logout should ONLY happen when user explicitly clicks the logout button
      if (!user) {
        console.log('🔍 User is null - this could be:');
        console.log('   1. Initial app load (before auth state is determined)');
        console.log('   2. User explicitly logged out');
        console.log('   3. Auth session expired/cleared');
        console.log('   ❌ This should NOT happen automatically - only on explicit logout');
      }
      
      setLoading(true);
      
      if (user) {
        console.log('✅ User is authenticated - maintaining session');
        setUser(user);
        
        // CRITICAL: Force sync localStorage to Firebase immediately
        await forceBalanceSync(user);
        
        // Load user profile with timeout for better UX
        const profileStartTime = Date.now();
        try {
          const profile = await Promise.race([
            loadUserProfile(user),
            new Promise<null>((_, reject) => 
              setTimeout(() => reject(new Error('Profile load timeout')), 10000) // 10 second timeout
            )
          ]);
          
          const profileEndTime = Date.now();
          if (profile) {
            console.log(`✅ Complete auth flow finished in ${profileEndTime - profileStartTime}ms`);
          } else {
            console.log(`⚠️ Auth completed but no profile in ${profileEndTime - profileStartTime}ms`);
          }
          
          setUserProfile(profile);
          
          // Start market data sync for authenticated users
          if (profile) {
            marketDataSyncService.startRealtimeSync(user.uid);
          }
        } catch (error) {
          console.warn('⏰ Profile loading timed out or failed:', error);
          setUserProfile(null); // Still allow user to be authenticated even without profile
        }
      } else {
        console.log('🔓 Clearing user state (user is null)');
        setUser(null);
        setUserProfile(null);
      }
      
      setLoading(false);
    });

    return unsubscribe;
  }, []);

  // Enhanced profile synchronization between localStorage and Firebase
  useEffect(() => {
    if (userProfile && user?.uid) {
      // Get current localStorage profile to check for balance differences
      const storedProfile = localStorage.getItem('userProfile');
      let localProfile = null;
      
      if (storedProfile) {
        try {
          localProfile = JSON.parse(storedProfile);
        } catch (error) {
          console.error('Error parsing stored profile:', error);
        }
      }
      
      // If localStorage has different balance/earnings/losses, update Firebase immediately
      if (localProfile && (
        localProfile.balance !== userProfile.balance ||
        localProfile.totalEarnings !== userProfile.totalEarnings ||
        localProfile.totalLosses !== userProfile.totalLosses
      )) {
        console.log('🔄 Balance mismatch detected - syncing localStorage to Firebase');
        console.log('Firebase balance:', userProfile.balance);
        console.log('localStorage balance:', localProfile.balance);
        
        // Update Firebase with localStorage values (localStorage wins)
        const updatedProfile = {
          ...userProfile,
          balance: localProfile.balance,
          totalEarnings: localProfile.totalEarnings,
          totalLosses: localProfile.totalLosses,
          updatedAt: serverTimestamp()
        };
        
        // Update Firebase
        setDoc(doc(db, 'users', user.uid), updatedProfile, { merge: true })
          .then(() => {
            console.log('✅ Firebase updated with localStorage balance');
            setUserProfile(updatedProfile);
          })
          .catch(error => {
            console.error('❌ Failed to update Firebase with localStorage balance:', error);
          });
      } else {
        // Normal sync - update localStorage with current profile
        const profileForStorage = {
          username: userProfile.username,
          balance: userProfile.balance,
          joinDate: userProfile.joinDate instanceof Date ? userProfile.joinDate.toLocaleDateString() : userProfile.joinDate,
          totalEarnings: userProfile.totalEarnings,
          totalLosses: userProfile.totalLosses
        };
        
        // Update localStorage for backward compatibility
        try {
          localStorage.setItem('userProfile', JSON.stringify(profileForStorage));
        } catch (error) {
          console.error('Failed to save profile to localStorage:', error);
        }
      }
      
      // Sync with Firebase periodically to keep data consistent
      const syncProfile = async () => {
        try {
          await dataReconciliationService.reconcileUserProfile(user.uid);
        } catch (error) {
          console.error('Background profile sync failed:', error);
        }
      };
      
      // Initial sync and then every 5 minutes
      syncProfile();
      const syncInterval = setInterval(syncProfile, 5 * 60 * 1000);
      
      return () => {
        clearInterval(syncInterval);
      };
    }
  }, [userProfile, user?.uid]);

  const value: AuthContextType = {
    user,
    userProfile,
    loading,
    signIn,
    signUp,
    logout,
    updateProfile,
    checkUsernameAvailability,
    testFirestoreConnection,
    forceSyncToFirebase,
  };

  // Make auth context available globally for other components
  useEffect(() => {
    if (typeof window !== 'undefined') {
      (window as any).authContext = value;
    }
  }, [value]);

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}; 