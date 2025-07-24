'use client';

import { useEffect, useState } from 'react';
import { 
  doc, 
  getDoc, 
  setDoc, 
  onSnapshot, 
  Timestamp,
  collection,
  query,
  where,
  getDocs 
} from 'firebase/firestore';
import { db } from '../lib/firebase';

// Firestore-native Bot Manager component
const BotManager = () => {
  const [botSystemState, setBotSystemState] = useState<{
    autoStart: boolean;
    isInitialized: boolean;
    botCount: number;
    lastUpdated: string;
    lastError?: string;
    lastRestart?: string;
  }>({
    autoStart: false,
    isInitialized: false,
    botCount: 0,
    lastUpdated: ''
  });

  const SETTINGS_DOC = doc(db, 'bot-settings', 'global');

  // Firestore-native method to get bot system state
  const getFirestoreBotState = async () => {
    try {
      const snap = await getDoc(SETTINGS_DOC);
      if (snap.exists()) {
        const data = snap.data();
        return {
          autoStart: !!data.autoStart,
          isInitialized: !!data.isInitialized,
          botCount: data.botCount || 0,
          lastUpdated: data.updatedAt?.toDate?.()?.toISOString() || data.lastUpdated || ''
        };
      }
      return {
        autoStart: false,
        isInitialized: false,
        botCount: 0,
        lastUpdated: ''
      };
    } catch (error) {
      console.error('❌ Error getting bot state from Firestore:', error);
      return {
        autoStart: false,
        isInitialized: false,
        botCount: 0,
        lastUpdated: ''
      };
    }
  };

  // Firestore-native method to set bot system state
  const setFirestoreBotState = async (state: Partial<typeof botSystemState>) => {
    try {
      await setDoc(SETTINGS_DOC, {
        ...state,
        updatedAt: Timestamp.now(),
        lastUpdated: new Date().toISOString(),
        source: 'bot_manager' // Required for Firestore permissions
      }, { merge: true });
    } catch (error) {
      console.error('❌ Error setting bot state in Firestore:', error);
    }
  };

  // Firestore-native method to count active bots
  const getActiveBotCount = async () => {
    try {
      const botsCol = collection(db, 'autonomous-bots');
      const activeQuery = query(botsCol, where('isActive', '==', true));
      const snapshot = await getDocs(activeQuery);
      return snapshot.size;
    } catch (error) {
      console.error('❌ Error counting active bots:', error);
      return 0;
    }
  };

  // Initialize bot system using Firestore-native methods
  useEffect(() => {
    const initializeBotSystem = async () => {
      try {
        console.log('🔍 Firestore-native BotManager starting...');
        
        // Wait for app to be ready
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        // Get current state from Firestore
        const currentState = await getFirestoreBotState();
        setBotSystemState(currentState);
        
        // Count active bots
        const activeBotCount = await getActiveBotCount();
        console.log(`📊 Found ${activeBotCount} active bots in Firestore`);
        
        // Import bot system
        console.log('🔍 Importing bot system...');
        const { botSystem } = await import('../components/autonomous-bots');
        console.log('✅ Bot system imported successfully!');
        
        // Initialize or restart bot system
        if (!currentState.isInitialized || !currentState.autoStart) {
          console.log('🚀 Initializing bot system for the first time...');
          
          // Set state to indicate we're starting
          await setFirestoreBotState({
            autoStart: true,
            isInitialized: true,
            botCount: activeBotCount
          });
          
          // Start the bot system
          if (typeof botSystem.restartSystem === 'function') {
            botSystem.restartSystem();
          } else {
            botSystem.startBots();
          }
          
          console.log('🤖 Bot system initialized and started!');
        } else {
          console.log('🔄 Bot system already initialized, ensuring it\'s running...');
          
          // Ensure bot system is running
          if (typeof botSystem.isSystemRunning === 'function') {
            const isRunning = botSystem.isSystemRunning();
            if (!isRunning) {
              console.log('🔄 Restarting inactive bot system...');
              botSystem.startBots();
            } else {
              console.log('✅ Bot system is already running');
            }
          } else {
            // Fallback - just start
            botSystem.startBots();
          }
        }
        
        // Update state with current bot count
        await setFirestoreBotState({
          botCount: activeBotCount
        });
        
      } catch (error) {
        console.error('❌ Error initializing Firestore-native bot system:', error);
        
                 // Set error state in Firestore
         await setFirestoreBotState({
           autoStart: false,
           isInitialized: false,
           lastError: error instanceof Error ? error.message : 'Unknown error'
         });
      }
    };
    
    initializeBotSystem();
  }, []);

  // Set up real-time listener for Firestore bot settings
  useEffect(() => {
    console.log('👂 Setting up Firestore listener for bot settings...');
    
    const unsubscribe = onSnapshot(SETTINGS_DOC, (doc) => {
      if (doc.exists()) {
        const data = doc.data();
        const newState = {
          autoStart: !!data.autoStart,
          isInitialized: !!data.isInitialized,
          botCount: data.botCount || 0,
          lastUpdated: data.updatedAt?.toDate?.()?.toISOString() || data.lastUpdated || ''
        };
        
        setBotSystemState(newState);
        console.log('📡 Bot settings updated from Firestore:', newState);
      }
    }, (error) => {
      console.error('❌ Error listening to bot settings:', error);
    });

    return () => {
      console.log('🔇 Cleaning up Firestore listener');
      unsubscribe();
    };
  }, []);

  // Periodic health check using Firestore
  useEffect(() => {
    const healthCheckInterval = setInterval(async () => {
      try {
        const currentState = await getFirestoreBotState();
        
        if (currentState.autoStart && currentState.isInitialized) {
          // Import and check bot system
          const { botSystem } = await import('../components/autonomous-bots');
          
          if (typeof botSystem.isSystemRunning === 'function') {
            const isRunning = botSystem.isSystemRunning();
            
            if (!isRunning) {
              console.log('🔄 Health check: Restarting inactive bot system...');
              botSystem.startBots();
              
              // Update Firestore with restart timestamp
              await setFirestoreBotState({
                lastRestart: new Date().toISOString()
              });
            }
          }
        }
      } catch (error) {
        console.error('❌ Health check error:', error);
      }
    }, 120000); // Check every 2 minutes

    return () => clearInterval(healthCheckInterval);
  }, []);

  return null; // This component doesn't render anything
};

export default BotManager;