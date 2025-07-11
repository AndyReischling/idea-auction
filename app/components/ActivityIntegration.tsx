"use client";

import { useEffect } from 'react';
import { onSnapshot, doc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../lib/auth-context';

interface UserProfile {
  username: string;
  balance: number;
  joinDate: string;
  totalEarnings: number;
  totalLosses: number;
}

interface ActivityIntegrationProps {
  userProfile?: UserProfile;
}

/**
 * ActivityIntegration
 * --------------------------------------------------------------
 * A tiny bridge that wires the globalActivityTracker helper to the
 * current Firebase‑backed user profile. No localStorage listeners
 * remain – the component now listens to the signed‑in user doc via
 * Firestore `onSnapshot`.
 */
const ActivityIntegration: React.FC<ActivityIntegrationProps> = ({ userProfile }) => {
  const { user } = useAuth();

  useEffect(() => {
    let unsubscribe: (() => void) | undefined;

    const init = async () => {
      try {
        const { default: globalActivityTracker } = await import('./GlobalActivityTracker');
        console.log('🔧 Initialising global activity tracker…');

        // Helper to push a profile into the tracker
        const applyProfile = (profile: UserProfile) => {
          // call whatever setter the tracker exposes
          (globalActivityTracker as any).setCurrentUser?.(profile) ||
          (globalActivityTracker as any).updateCurrentUser?.(profile) ||
          (globalActivityTracker as any).setUser?.(profile);
          console.log('👤 Tracker user set →', profile.username);
        };

        // If a profile was passed as prop (e.g. SSR), apply immediately
        if (userProfile) applyProfile(userProfile);

        // Listen to live profile updates via Firestore
        if (user?.uid) {
          const userDoc = doc(db, 'users', user.uid);
          unsubscribe = onSnapshot(userDoc, snap => {
            if (snap.exists()) {
              applyProfile(snap.data() as UserProfile);
            }
          });
        }

        console.log('✅ Global activity tracker initialised');
      } catch (err) {
        console.error('❌ Failed to initialise activity tracker', err);
      }
    };

    init();
    return () => unsubscribe?.();
  }, [user, userProfile]);

  // No visible output
  return null;
};

export default ActivityIntegration;
