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
 * A bridge that ensures the GlobalActivityTracker gets real-time updates
 * of the user profile from Firestore. The main initialization is now handled
 * by the auth context, but we still need to listen for profile changes.
 */
const ActivityIntegration: React.FC<ActivityIntegrationProps> = ({ userProfile }) => {
  const { user } = useAuth();

  useEffect(() => {
    let unsubscribe: (() => void) | undefined;

    const init = async () => {
      try {
        const { default: globalActivityTracker } = await import('./GlobalActivityTracker');
        console.log('🔧 ActivityIntegration: Setting up real-time profile updates…');

        // Helper to update tracker with profile changes
        const updateTrackerProfile = (profile: UserProfile) => {
          globalActivityTracker.updateCurrentUser({
            uid: user?.uid || '',
            username: profile.username,
            balance: profile.balance,
            totalEarnings: profile.totalEarnings,
            totalLosses: profile.totalLosses,
            joinDate: new Date(profile.joinDate),
            createdAt: new Date(), // We don't have this in the UserProfile interface
            updatedAt: new Date()
          });
          console.log('👤 ActivityIntegration: Updated tracker with profile →', profile.username);
        };

        // If a profile was passed as prop (e.g. SSR), update immediately
        if (userProfile && user?.uid) {
          updateTrackerProfile(userProfile);
        }

        // Listen to live profile updates via Firestore
        if (user?.uid) {
          const userDoc = doc(db, 'users', user.uid);
          unsubscribe = onSnapshot(userDoc, snap => {
            if (snap.exists()) {
              const data = snap.data() as UserProfile;
              updateTrackerProfile(data);
            }
          });
        }

        console.log('✅ ActivityIntegration: Real-time profile updates initialized');
      } catch (err) {
        console.error('❌ ActivityIntegration: Failed to initialize profile updates', err);
      }
    };

    // Only initialize if we have a user
    if (user?.uid) {
      init();
    }

    return () => unsubscribe?.();
  }, [user, userProfile]);

  // No visible output
  return null;
};

export default ActivityIntegration;
