'use client';

import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { 
  User, 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  sendPasswordResetEmail,
  sendEmailVerification,
  sendSignInLinkToEmail,
  isSignInWithEmailLink,
  signInWithEmailLink,
  AuthError
} from 'firebase/auth';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { auth, db } from './firebase';

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
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, username: string) => Promise<void>;
  logout: () => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  sendLoginLink: (email: string) => Promise<void>;
  completeLoginLink: (email: string) => Promise<void>;
  updateProfile: (updates: Partial<UserProfile>) => Promise<void>;
  checkUsernameAvailability: (username: string) => Promise<boolean>;
  testFirestoreConnection: () => Promise<boolean>;
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

  // Generate unique username
  const generateUsername = async (): Promise<string> => {
    const adjectives = ['Quick', 'Smart', 'Bold', 'Clever', 'Sharp', 'Bright', 'Swift', 'Keen'];
    const nouns = ['Trader', 'Investor', 'Analyst', 'Strategist', 'Expert', 'Pro', 'Guru', 'Maverick'];
    
    let attempts = 0;
    while (attempts < 10) {
      const adjective = adjectives[Math.floor(Math.random() * adjectives.length)];
      const noun = nouns[Math.floor(Math.random() * nouns.length)];
      const number = Math.floor(Math.random() * 999) + 1;
      const username = `${adjective}${noun}${number}`;
      
      const isAvailable = await checkUsernameAvailability(username);
      if (isAvailable) {
        return username;
      }
      attempts++;
    }
    
    // Fallback to timestamp-based username
    return `OpinionTrader${Date.now()}`;
  };

  // Check if username is available
  const checkUsernameAvailability = async (username: string): Promise<boolean> => {
    try {
      const usernameDoc = await getDoc(doc(db, 'usernames', username.toLowerCase()));
      return !usernameDoc.exists();
    } catch (error) {
      console.error('Error checking username availability:', error);
      return false;
    }
  };

  // Create user profile in Firestore
  const createUserProfile = async (user: User, username: string): Promise<UserProfile> => {
    const userProfile: UserProfile = {
      uid: user.uid,
      email: user.email || '',
      username,
      balance: 10000, // Starting balance
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

    // Save user profile
    await setDoc(doc(db, 'users', user.uid), userProfile);
    
    // Reserve username
    await setDoc(doc(db, 'usernames', username.toLowerCase()), {
      uid: user.uid,
      username,
      createdAt: serverTimestamp(),
    });

    return userProfile;
  };

  // Load user profile from Firestore
  const loadUserProfile = async (user: User): Promise<UserProfile | null> => {
    try {
      const userDoc = await getDoc(doc(db, 'users', user.uid));
      if (userDoc.exists()) {
        return userDoc.data() as UserProfile;
      }
      return null;
    } catch (error) {
      console.error('Error loading user profile:', error);
      return null;
    }
  };

  // Authentication functions
  const login = async (email: string, password: string): Promise<void> => {
    try {
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      const profile = await loadUserProfile(userCredential.user);
      setUserProfile(profile);
    } catch (error) {
      const authError = error as AuthError;
      throw new Error(authError.message);
    }
  };

  const register = async (email: string, password: string, username: string): Promise<void> => {
    try {
      // Check if username is available
      const isAvailable = await checkUsernameAvailability(username);
      if (!isAvailable) {
        throw new Error('Username is already taken');
      }

      // Create user account
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      
      // Send email verification
      await sendEmailVerification(userCredential.user);
      
      // Create user profile
      const profile = await createUserProfile(userCredential.user, username);
      setUserProfile(profile);
    } catch (error) {
      const authError = error as AuthError;
      throw new Error(authError.message);
    }
  };

  const logout = async (): Promise<void> => {
    try {
      await signOut(auth);
      setUserProfile(null);
    } catch (error) {
      const authError = error as AuthError;
      throw new Error(authError.message);
    }
  };

  const resetPassword = async (email: string): Promise<void> => {
    try {
      await sendPasswordResetEmail(auth, email);
    } catch (error) {
      const authError = error as AuthError;
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
        updatedAt: serverTimestamp(),
      };

      await setDoc(doc(db, 'users', user.uid), updatedProfile, { merge: true });
      setUserProfile(updatedProfile);
    } catch (error) {
      console.error('Error updating profile:', error);
      throw new Error('Failed to update profile');
    }
  };

  // Email Link Authentication
  const sendLoginLink = async (email: string): Promise<void> => {
    try {
      const actionCodeSettings = {
        url: `${window.location.origin}/auth-complete`,
        handleCodeInApp: true,
      };
      
      await sendSignInLinkToEmail(auth, email, actionCodeSettings);
      // Save email locally to complete sign-in
      localStorage.setItem('emailForSignIn', email);
    } catch (error) {
      const authError = error as AuthError;
      throw new Error(authError.message);
    }
  };

  const completeLoginLink = async (email: string): Promise<void> => {
    try {
      if (isSignInWithEmailLink(auth, window.location.href)) {
        await signInWithEmailLink(auth, email, window.location.href);
        localStorage.removeItem('emailForSignIn');
      } else {
        throw new Error('Invalid sign-in link');
      }
    } catch (error) {
      const authError = error as AuthError;
      throw new Error(authError.message);
    }
  };

  // Firestore Connection Test
  const testFirestoreConnection = async (): Promise<boolean> => {
    try {
      // Try to read a simple document to test connection
      const testDoc = doc(db, 'test', 'connection');
      await getDoc(testDoc);
      console.log('✅ Firestore connection successful');
      return true;
    } catch (error) {
      console.error('❌ Firestore connection failed:', error);
      return false;
    }
  };

  // Monitor authentication state
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setLoading(true);
      
      if (user) {
        setUser(user);
        
        // Load or create user profile
        let profile = await loadUserProfile(user);
        
        if (!profile) {
          // Create profile for existing user (migration case)
          const username = await generateUsername();
          profile = await createUserProfile(user, username);
        }
        
        setUserProfile(profile);
      } else {
        setUser(null);
        setUserProfile(null);
      }
      
      setLoading(false);
    });

    return unsubscribe;
  }, []);

  const value: AuthContextType = {
    user,
    userProfile,
    loading,
    login,
    register,
    logout,
    resetPassword,
    sendLoginLink,
    completeLoginLink,
    updateProfile,
    checkUsernameAvailability,
    testFirestoreConnection,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}; 