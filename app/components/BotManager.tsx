import { useEffect } from 'react';

// Simple Bot Manager component - inline
const BotManager = () => {
  useEffect(() => {
    const initializeBots = async () => {
      try {
        console.log('🔍 Homepage BotManager starting...');
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        console.log('🔍 Importing bot system...');
        // Fixed import path - from page.tsx to components folder
        const { default: botSystem } = await import('../components/autonomous-bots');
        console.log('✅ Bot system imported successfully!');
        
        // Check if already running
        if (!botSystem.isSystemRunning()) {
          botSystem.startBots();
          localStorage.setItem('botsAutoStart', 'true');
          localStorage.setItem('botsInitialized', 'true');
          console.log('🤖 Bots started from homepage!');
        } else {
          console.log('🤖 Bots already running');
        }
        
        // Keep bots alive
        const keepAliveInterval = setInterval(() => {
          const shouldBeRunning = localStorage.getItem('botsAutoStart') === 'true';
          const currentlyRunning = botSystem.isSystemRunning();
          
          if (shouldBeRunning && !currentlyRunning) {
            console.log('🔄 Restarting bots from homepage...');
            botSystem.startBots();
          }
        }, 30000);

        // Cleanup on unmount
        return () => clearInterval(keepAliveInterval);
        
      } catch (error) {
        console.error('❌ Bot error from homepage:', error);
      }
    };
    
    initializeBots();
  }, []);
  
  return null;
};