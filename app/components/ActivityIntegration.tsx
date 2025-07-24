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
 * of the user profile from Firestore. Also provides hooks for triggering
 * immediate data refreshes when activity occurs.
 */
const ActivityIntegration: React.FC<ActivityIntegrationProps> = ({ userProfile }) => {
  const { user } = useAuth();

  useEffect(() => {
    let unsubscribe: (() => void) | undefined;

    const init = async () => {
      try {
        const { default: globalActivityTracker } = await import('./GlobalActivityTracker');
        console.log('🔧 ActivityIntegration: Setting up real-time profile updates for user:', user?.uid);

        // Helper to update tracker with profile changes
        const updateTrackerProfile = (profile: UserProfile) => {
          const userData = {
            uid: user?.uid || '',
            username: profile.username,
            balance: profile.balance,
            totalEarnings: profile.totalEarnings,
            totalLosses: profile.totalLosses,
            joinDate: ((profile.joinDate as any)?.toDate ? (profile.joinDate as any).toDate() : new Date(profile.joinDate as any)),
            createdAt: new Date(), // We don't have this in the UserProfile interface
            updatedAt: new Date()
          };
          
          console.log('👤 ActivityIntegration: Updating tracker with user data:', userData);
          globalActivityTracker.updateCurrentUser(userData);
        };

        // If a profile was passed as prop (e.g. SSR), update immediately
        if (userProfile && user?.uid) {
          console.log('👤 ActivityIntegration: Using provided userProfile:', userProfile);
          updateTrackerProfile(userProfile);
        }

        // Listen to live profile updates via Firestore
        if (user?.uid) {
          const userDoc = doc(db, 'users', user.uid);
          console.log('🔧 ActivityIntegration: Setting up Firestore profile subscription for:', user.uid);
          unsubscribe = onSnapshot(userDoc, snap => {
            if (snap.exists()) {
              const data = snap.data() as UserProfile;
              console.log('🔥 ActivityIntegration: Profile updated from Firestore:', data);
              updateTrackerProfile(data);
              
              // Dispatch a custom event to notify other components of profile changes
              window.dispatchEvent(new CustomEvent('user-profile-updated', { 
                detail: { userId: user.uid, profile: data } 
              }));
            } else {
              console.warn('⚠️ ActivityIntegration: User document does not exist:', user.uid);
            }
          }, (error) => {
            console.error('❌ ActivityIntegration: Profile subscription error:', error);
          });
        }

        console.log('✅ ActivityIntegration: Real-time profile updates initialized');
      } catch (err) {
        console.error('❌ ActivityIntegration: Failed to initialize profile updates', err);
      }
    };

    // Only initialize if we have a user
    if (user?.uid) {
      console.log('🔧 ActivityIntegration: Initializing for authenticated user:', user.uid);
      init();
    } else {
      console.log('⚠️ ActivityIntegration: No authenticated user, skipping initialization');
    }

    return () => {
      if (unsubscribe) {
        console.log('🔧 ActivityIntegration: Cleaning up profile subscription');
        unsubscribe();
      }
    };
  }, [user, userProfile]);

  // No visible output
  return null;
};

export default ActivityIntegration;
