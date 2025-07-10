'use client';

import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { 
  User, 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  signOut, 
  onAuthStateChanged,
  sendPasswordResetEmail
} from 'firebase/auth';
import { auth } from './firebase';
import { firebaseDataService, UserProfile } from './firebase-data-service';
import { realtimeDataService } from './realtime-data-service';

// Types
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
  forceSyncToFirebase: () => Promise<{ message: string }>;
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

  // Auth state listener
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      console.log('🔐 Auth state changed:', user ? 'signed in' : 'signed out');
      setUser(user);
      
      if (user) {
        await loadUserProfile(user.uid);
      } else {
        setUserProfile(null);
      }
      
      setLoading(false);
    });

    return unsubscribe;
  }, []);

  // Load user profile and all user data from Firebase for session continuity
  const loadUserProfile = async (userId: string) => {
    try {
      console.log('📱 Loading complete user data from Firebase...');
      
      // Load user profile
      const profile = await firebaseDataService.getUserProfile(userId);
      
      if (profile) {
        setUserProfile(profile);
        console.log('✅ User profile loaded:', profile);
        
        // FIXED: Load all user data for complete session continuity
        await loadCompleteUserData(userId);
      } else {
        console.log('❌ No user profile found, creating default profile');
        await createDefaultProfile(userId);
      }
    } catch (error) {
      console.error('❌ Error loading user profile:', error);
      setUserProfile(null);
    }
  };

  // Load complete user data for session continuity
  const loadCompleteUserData = async (userId: string) => {
    try {
      console.log('🔄 Loading complete user data for session continuity...');
      
      // Load user opinions from Firebase (will override localStorage)
      const opinions = await realtimeDataService.getOpinions();
      console.log(`📊 Loaded ${opinions.length} opinions from Firebase`);
      
      // Load user portfolio from Firebase (will override localStorage)
      const portfolio = await realtimeDataService.getUserPortfolio(userId);
      console.log(`💼 Loaded ${portfolio.length} portfolio items from Firebase`);
      
      // Load user transactions from Firebase
      const transactions = await realtimeDataService.getUserTransactions(userId);
      console.log(`💸 Loaded ${transactions.length} transactions from Firebase`);
      
      // Clear any potentially conflicting localStorage data
      console.log('🧹 Clearing potentially stale localStorage data...');
      
      // Don't clear all localStorage, just ensure Firebase data takes precedence
      // The realtimeDataService methods already handle this by saving Firebase data to localStorage
      
      console.log('✅ Complete user data loaded for session continuity');
      
    } catch (error) {
      console.error('❌ Error loading complete user data:', error);
    }
  };

  // Create default profile for new users
  const createDefaultProfile = async (userId: string) => {
    try {
      const defaultProfile: Partial<UserProfile> = {
        uid: userId,
        username: auth.currentUser?.email?.split('@')[0] || 'User',
        balance: 10000,
        totalEarnings: 0,
        totalLosses: 0,
        joinDate: new Date(),
        createdAt: new Date(),
        updatedAt: new Date()
      };

      await firebaseDataService.createUserProfile(userId, defaultProfile);
      
      // Load the newly created profile
      await loadUserProfile(userId);
    } catch (error) {
      console.error('❌ Error creating default profile:', error);
    }
  };

  // Sign in
  const signIn = async (email: string, password: string) => {
    try {
      console.log('🔐 Signing in user...');
      await signInWithEmailAndPassword(auth, email, password);
      // Profile will be loaded automatically by the auth state listener
    } catch (error) {
      console.error('❌ Sign in error:', error);
      throw error;
    }
  };

  // Sign up
  const signUp = async (email: string, password: string, username: string) => {
    try {
      console.log('🔐 Creating new user account...');
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      
      // Create user profile with provided username
      const profileData: Partial<UserProfile> = {
        uid: userCredential.user.uid,
        username: username,
        balance: 10000,
        totalEarnings: 0,
        totalLosses: 0,
        joinDate: new Date()
      };

      await firebaseDataService.createUserProfile(userCredential.user.uid, profileData);
      console.log('✅ User account and profile created successfully');
    } catch (error) {
      console.error('❌ Sign up error:', error);
      throw error;
    }
  };

  // Logout
  const logout = async () => {
    try {
      console.log('🔐 Signing out user...');
      await signOut(auth);
      setUser(null);
      setUserProfile(null);
    } catch (error) {
      console.error('❌ Logout error:', error);
      throw error;
    }
  };

  // Update profile
  const updateProfile = async (updates: Partial<UserProfile>) => {
    if (!user?.uid) {
      throw new Error('No authenticated user');
    }

    try {
      console.log('👤 Updating user profile:', updates);
      await firebaseDataService.updateUserProfile(user.uid, updates);
      
      // Update local state
      if (userProfile) {
        setUserProfile({ ...userProfile, ...updates });
      }
    } catch (error) {
      console.error('❌ Error updating profile:', error);
      throw error;
    }
  };

  // Check username availability
  const checkUsernameAvailability = async (username: string): Promise<boolean> => {
    // TODO: Implement username uniqueness check
    // For now, return true (available)
    return true;
  };

  // Update balance
  const updateBalance = async (newBalance: number) => {
    if (!user?.uid) {
      throw new Error('No authenticated user');
    }

    try {
      console.log('💰 Updating user balance:', newBalance);
      await firebaseDataService.updateUserBalance(user.uid, newBalance);
      
      // Update local state
      if (userProfile) {
        setUserProfile({ ...userProfile, balance: newBalance });
      }
    } catch (error) {
      console.error('❌ Error updating balance:', error);
      throw error;
    }
  };

  // Increment balance
  const incrementBalance = async (amount: number) => {
    if (!user?.uid) {
      throw new Error('No authenticated user');
    }

    try {
      console.log('💰 Incrementing user balance by:', amount);
      await firebaseDataService.incrementUserBalance(user.uid, amount);
      
      // Update local state
      if (userProfile) {
        setUserProfile({ ...userProfile, balance: userProfile.balance + amount });
      }
    } catch (error) {
      console.error('❌ Error incrementing balance:', error);
      throw error;
    }
  };

  // Update earnings
  const updateEarnings = async (earnings: number, losses: number) => {
    if (!user?.uid) {
      throw new Error('No authenticated user');
    }

    try {
      console.log('📈 Updating user earnings:', { earnings, losses });
      await firebaseDataService.updateUserEarnings(user.uid, earnings, losses);
      
      // Update local state
      if (userProfile) {
        setUserProfile({ 
          ...userProfile, 
          totalEarnings: earnings, 
          totalLosses: losses 
        });
      }
    } catch (error) {
      console.error('❌ Error updating earnings:', error);
      throw error;
    }
  };

  // Reset password
  const resetPassword = async (email: string) => {
    try {
      console.log('🔐 Sending password reset email...');
      await sendPasswordResetEmail(auth, email);
    } catch (error) {
      console.error('❌ Password reset error:', error);
      throw error;
    }
  };

  // Force sync to Firebase (e.g., for testing)
  const forceSyncToFirebase = async () => {
    if (!user?.uid) {
      throw new Error('No authenticated user to sync');
    }
    try {
      console.log('⚙️ Forcing sync to Firebase for user:', user.uid);
      
      // Get current localStorage profile
      const localProfile = JSON.parse(localStorage.getItem('userProfile') || '{}');
      
      if (Object.keys(localProfile).length > 0) {
        // Update Firebase with current localStorage data
        await firebaseDataService.updateUserProfile(user.uid, {
          balance: localProfile.balance || 10000,
          totalEarnings: localProfile.totalEarnings || 0,
          totalLosses: localProfile.totalLosses || 0,
          username: localProfile.username || 'User'
        });
        console.log('✅ Synced localStorage profile to Firebase');
        return { message: 'Successfully synced localStorage data to Firebase' };
      } else {
        console.log('✅ No localStorage data to sync');
        return { message: 'No localStorage data found to sync' };
      }
    } catch (error) {
      console.error('❌ Error forcing sync to Firebase:', error);
      throw error;
    }
  };

  // Make auth context available globally for other components
  useEffect(() => {
    if (typeof window !== 'undefined') {
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
        forceSyncToFirebase
      };
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
    forceSyncToFirebase
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
} 