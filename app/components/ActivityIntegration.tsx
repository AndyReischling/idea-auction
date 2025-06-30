// components/ActivityIntegration.tsx
// Minimal component that just ensures global functions are available

'use client';

import { useEffect } from 'react';

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

const ActivityIntegration: React.FC<ActivityIntegrationProps> = ({
  userProfile
}) => {
  useEffect(() => {
    const initializeGlobalTracker = async () => {
      try {
        console.log('🔧 Initializing global activity tracking system...');
        
        // Import the global tracker (this will set up window globals)
        const { default: globalActivityTracker } = await import('./GlobalActivityTracker');
        
        // Set current user if provided
        if (userProfile) {
          globalActivityTracker.setCurrentUser(userProfile);
        } else {
          // Load from localStorage if no userProfile provided
          const storedProfile = localStorage.getItem('userProfile');
          if (storedProfile) {
            try {
              const parsed = JSON.parse(storedProfile);
              globalActivityTracker.setCurrentUser(parsed);
            } catch (error) {
              console.error('Error parsing stored user profile:', error);
            }
          }
        }

        // Listen for user profile changes from localStorage
        const handleStorageChange = (e: StorageEvent) => {
          if (e.key === 'userProfile' && e.newValue) {
            try {
              const updatedUser = JSON.parse(e.newValue);
              globalActivityTracker.setCurrentUser(updatedUser);
              console.log('👤 User profile updated from storage:', updatedUser.username);
            } catch (error) {
              console.error('Error parsing updated user profile:', error);
            }
          }
        };

        // Listen for manual user profile updates
        const handleUserProfileUpdate = (event: CustomEvent) => {
          const updatedUser = event.detail;
          globalActivityTracker.setCurrentUser(updatedUser);
          console.log('👤 User profile updated from event:', updatedUser.username);
        };

        // Add event listeners
        window.addEventListener('storage', handleStorageChange);
        window.addEventListener('userProfileUpdated', handleUserProfileUpdate as EventListener);

        console.log('✅ Global activity tracking system initialized successfully!');
        console.log('🎯 The following functions are now available globally:');
        console.log('   - addToGlobalFeed() ✅');
        console.log('   - trackTrade() ✅');
        console.log('   - interceptBuyTransaction() ✅');
        console.log('   - interceptSellTransaction() ✅');

        // Test to make sure functions are available
        if (typeof (window as any).addToGlobalFeed === 'function') {
          console.log('✅ addToGlobalFeed is ready');
        } else {
          console.error('❌ addToGlobalFeed not available!');
        }

        if (typeof (window as any).trackTrade === 'function') {
          console.log('✅ trackTrade is ready');
        } else {
          console.error('❌ trackTrade not available!');
        }

        // Cleanup function
        return () => {
          window.removeEventListener('storage', handleStorageChange);
          window.removeEventListener('userProfileUpdated', handleUserProfileUpdate as EventListener);
        };

      } catch (error) {
        console.error('❌ Failed to initialize global activity tracking:', error);
      }
    };

    initializeGlobalTracker();
  }, [userProfile]);

  // This component doesn't render anything visible
  return null;
};

export default ActivityIntegration;