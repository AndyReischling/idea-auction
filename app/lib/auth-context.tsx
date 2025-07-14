'use client';

import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import {
  User,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  sendPasswordResetEmail,
} from 'firebase/auth';
import { auth } from './firebase';
import { firebaseDataService, UserProfile } from './firebase-data-service';
import { realtimeDataService } from './realtime-data-service';

// -----------------------------------------------------------------------------
// 🔖 Types
// -----------------------------------------------------------------------------
interface AuthContextType {
  user: User | null;
  userProfile: UserProfile | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string, username: string) => Promise<void>;
  logout: () => Promise<void>;
  updateProfile: (updates: Partial<UserProfile>) => Promise<void>;
  checkUsernameAvailability: (username: string) => Promise<boolean>;
  updateBalance: (newBalance: number) => Promise<void>;
  incrementBalance: (amount: number) => Promise<void>;
  updateEarnings: (earnings: number, losses: number) => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  /** Re‑pull the latest profile straight from Firestore and overwrite local state */
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

interface AuthProviderProps {
  children: ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps) {
  const [user, setUser] = useState<User | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  // ---------------------------------------------------------------------------
  // 🔑 Auth state listener – always trust Firebase as the single source of truth
  // ---------------------------------------------------------------------------
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async current => {
      console.log('🔐 Auth state changed:', current ? `signed in (${current.email})` : 'signed out');
      setUser(current);
      if (current) await loadUserProfile(current.uid);
      else setUserProfile(null);
      setLoading(false);
    });
    return unsubscribe;
  }, []);

  // ---------------------------------------------------------------------------
  // 📄 Profile helpers – Firestore only (no localStorage fallback)
  // ---------------------------------------------------------------------------
  const loadUserProfile = async (uid: string) => {
    try {
      const profile = await firebaseDataService.getUserProfile(uid);
      if (profile) {
        setUserProfile(profile);
        await preloadSessionData(uid);
      } else {
        await createDefaultProfile(uid);
      }
    } catch (err) {
      console.error('❌ Failed to load profile', err);
      setUserProfile(null);
    }
  };

  /** Pre‑fetch related collections so first paint already has everything. */
  const preloadSessionData = async (uid: string) => {
    try {
      const opinions = await realtimeDataService.getOpinions();
      console.log(`✨ Session hydrated → opinions:${opinions.length}`);
    } catch (err) {
      console.error('❌ Failed to hydrate session', err);
    }
  };

  const createDefaultProfile = async (uid: string) => {
    const profile: Partial<UserProfile> = {
      uid,
      username: auth.currentUser?.email?.split('@')[0] || 'User',
      balance: 10_000,
      totalEarnings: 0,
      totalLosses: 0,
      joinDate: new Date(),
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    await firebaseDataService.createUserProfile(uid, profile);
    await loadUserProfile(uid);
  };

  // ---------------------------------------------------------------------------
  // 👥 Public API – thin wrappers around the service layer
  // ---------------------------------------------------------------------------
  const signIn = async (email: string, password: string) => {
    await signInWithEmailAndPassword(auth, email, password);
  };

  const signUp = async (email: string, password: string, username: string) => {
    const { user: newUser } = await createUserWithEmailAndPassword(auth, email, password);
    await firebaseDataService.createUserProfile(newUser.uid, {
      uid: newUser.uid,
      username,
      balance: 10_000,
      totalEarnings: 0,
      totalLosses: 0,
      joinDate: new Date(),
    });
  };

  const logout = async () => {
    try {
      await signOut(auth);
      setUser(null);
      setUserProfile(null);
    } catch (error) {
      console.error('❌ Logout error:', error);
      // Even if signOut fails, clear local state
      setUser(null);
      setUserProfile(null);
    }
  };

  const updateProfile = async (updates: Partial<UserProfile>) => {
    if (!user?.uid) throw new Error('No authenticated user');
    await firebaseDataService.updateUserProfile(user.uid, updates);
    setUserProfile(prev => (prev ? { ...prev, ...updates } : prev));
  };

  const checkUsernameAvailability = async () => true; // TODO – implement server check

  const updateBalance = async (balance: number) => {
    if (!user?.uid) throw new Error('No authenticated user');
    await firebaseDataService.updateUserProfile(user.uid, { balance });
    setUserProfile(prev => (prev ? { ...prev, balance } : prev));
  };

  const incrementBalance = async (amount: number) => {
    if (!user?.uid) throw new Error('No authenticated user');
    await firebaseDataService.incrementUserStat(user.uid, 'balance', amount);
    setUserProfile(prev => (prev ? { ...prev, balance: prev.balance + amount } : prev));
  };

  const updateEarnings = async (earnings: number, losses: number) => {
    if (!user?.uid) throw new Error('No authenticated user');
    await firebaseDataService.updateUserProfile(user.uid, { totalEarnings: earnings, totalLosses: losses });
    setUserProfile(prev =>
      prev ? { ...prev, totalEarnings: earnings, totalLosses: losses } : prev
    );
  };

  const resetPassword = async (email: string) => {
    await sendPasswordResetEmail(auth, email);
  };

  /** Force‑refresh the profile from Firestore (handy for tests / dev tools). */
  const refreshProfile = async () => {
    if (!user?.uid) throw new Error('No authenticated user');
    await loadUserProfile(user.uid);
    return { message: 'Profile refreshed from Firestore' };
  };

  // ---------------------------------------------------------------------------
  // 🌍 Expose helpers to the window (dev builds only) and initialize GlobalActivityTracker
  // ---------------------------------------------------------------------------
  useEffect(() => {
    if (typeof window === 'undefined') return;
    (window as any).authContext = {
      user,
      userProfile,
      loading,
      signIn,
      signUp,
      logout,
      updateProfile,
      checkUsernameAvailability,
      updateBalance,
      incrementBalance,
      updateEarnings,
      resetPassword,
      refreshProfile,
    };

    // Initialize GlobalActivityTracker when auth context is ready
    if (user && userProfile) {
      import('../components/GlobalActivityTracker').then((module) => {
        const tracker = module.default; // This is already the singleton instance
        tracker.initializeWithAuthContext();
        tracker.updateCurrentUser(userProfile);
      });
    }
  }, [user, userProfile, loading]);

  const value: AuthContextType = {
    user,
    userProfile,
    loading,
    signIn,
    signUp,
    logout,
    updateProfile,
    checkUsernameAvailability,
    updateBalance,
    incrementBalance,
    updateEarnings,
    resetPassword,
    refreshProfile: async () => {
      const result = await refreshProfile();
      return;
    },
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
