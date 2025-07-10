'use client';

import { useEffect, useState, useMemo, useCallback } from 'react';
import Sidebar from '../components/Sidebar';
import '../global.css';
import styles from './page.module.css';
import { ScanSmiley } from '@phosphor-icons/react/dist/icons/ScanSmiley';
import { RssSimple } from '@phosphor-icons/react/dist/icons/RssSimple';
import { Wallet } from '@phosphor-icons/react/dist/icons/Wallet';
import { NotePencil } from '@phosphor-icons/react/dist/icons/NotePencil';
import { PlayCircle } from '@phosphor-icons/react/dist/icons/PlayCircle';
import AuthButton from '../components/AuthButton';
import { useRouter } from 'next/navigation';

function GenerateOpinions() {
  const [opinion, setOpinion] = useState('Click the button to generate an opinion!');
  const [userInput, setUserInput] = useState('');
  const [allOpinions, setAllOpinions] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [lastGenerated, setLastGenerated] = useState<string>('');

  const MAX_CHARS = 500;
  const router = useRouter();
  
  // Calculate charCount directly from userInput to avoid infinite loop
  const charCount = userInput.length;

  // Memoize sidebar opinions to prevent re-renders
  const sidebarOpinions = useMemo(() => {
    return allOpinions.map((text, i) => ({ id: i.toString(), text: text || '' }));
  }, [allOpinions]);

  // Memoize stats calculations
  const stats = useMemo(() => ({
    totalOpinions: allOpinions.length,
    generatedToday: lastGenerated ? 1 : 0,
    draftReady: userInput.trim() ? 1 : 0
  }), [allOpinions.length, lastGenerated, userInput]);

  // Memoize character count class calculation
  const charCountClass = useMemo(() => {
    if (charCount > MAX_CHARS) return styles.error;
    if (charCount > MAX_CHARS * 0.8) return styles.warning;
    return '';
  }, [charCount, MAX_CHARS]);

  // Debounced localStorage save function
  const saveToLocalStorage = useCallback((opinions: string[]) => {
    try {
      localStorage.setItem('opinions', JSON.stringify(opinions));
    } catch (error) {
      console.error('Error saving opinions to localStorage:', error);
    }
  }, []);

  // Helper function to track opinion source
  const trackOpinionSource = useCallback((opinionText: string, source: 'ai' | 'user') => {
    try {
      const existingSources = JSON.parse(localStorage.getItem('opinion-sources') || '{}');
      existingSources[opinionText] = source;
      localStorage.setItem('opinion-sources', JSON.stringify(existingSources));
      console.log(`📝 Tracked source: "${opinionText.slice(0, 30)}..." = ${source.toUpperCase()}`);
    } catch (error) {
      console.error('Error tracking opinion source:', error);
    }
  }, []);

  useEffect(() => {
    try {
      const stored = localStorage.getItem('opinions');
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed)) {
          const validOpinions = parsed.filter(op => op && typeof op === 'string' && op.trim().length > 0);
          setAllOpinions(validOpinions);
        }
      }
    } catch (error) {
      console.error('Error loading opinions:', error);
      setAllOpinions([]);
    }
  }, []);

  const generateOpinion = useCallback(async () => {
    setLoading(true);
    
    try {
      const response = await fetch('/api/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error('Failed to generate opinion');
      }

      const data = await response.json();
      const newOpinion = data.opinion;
      
      setOpinion(newOpinion);
      setLastGenerated(newOpinion);
      
      const updatedOpinions = [...allOpinions, newOpinion];
      setAllOpinions(updatedOpinions);
      saveToLocalStorage(updatedOpinions);
      
      // DEBUG: Check if opinions are being saved correctly
      console.log('🔍 DEBUG: Generated new opinion:', newOpinion);
      console.log('🔍 DEBUG: Updated opinions array:', updatedOpinions);
      console.log('🔍 DEBUG: Opinions saved to localStorage:', JSON.parse(localStorage.getItem('opinions') || '[]'));
      
      // CRITICAL FIX: Clear realtimeDataService cache to force refresh
      if (typeof window !== 'undefined') {
        try {
          // Import and clear cache
          const { realtimeDataService } = await import('../lib/realtime-data-service');
          (realtimeDataService as any).cache = {}; // Clear the cache
          console.log('✅ RealtimeDataService cache cleared');
        } catch (error) {
          console.error('Error clearing cache:', error);
        }
        
        // Method 1: Use the global refresh function
        if ((window as any).refreshSidebar) {
          (window as any).refreshSidebar();
          console.log('✅ Sidebar refresh triggered via global function');
        } else {
          console.log('⚠️ refreshSidebar function not available');
        }
        
        // Method 2: Dispatch custom event
        window.dispatchEvent(new CustomEvent('manualRefresh'));
        console.log('✅ Manual refresh event dispatched');
        
        // Method 3: Dispatch storage-like event
        window.dispatchEvent(new CustomEvent('localStorageChange', {
          detail: { key: 'opinions', newValue: JSON.stringify(updatedOpinions) }
        }));
        console.log('✅ Local storage change event dispatched');
      }
      
      // CRITICAL FIX: Track opinion generation using GlobalActivityTracker
      try {
        // Dynamically import to avoid breaking the main flow
        const { default: GlobalActivityTracker } = await import('../components/GlobalActivityTracker');
        await GlobalActivityTracker.trackOpinionGeneration(newOpinion, false);
        console.log('✅ Opinion generation tracked via GlobalActivityTracker');
      } catch (error) {
        console.error('Error tracking opinion generation:', error);
        // Don't let tracking errors break the main flow
      }
      
    } catch (error) {
      console.error('Error generating opinion:', error);
      
      const mockOpinions = [
        "I'm against picketing, but I don't know how to show it.",
        "I like vending machines 'cause snacks are better when they fall. If I buy a candy bar at a store, oftentimes, I will drop it... So that it achieves its maximum flavor potential",
        "All right, now that the popsicle's melted we've got ourselves a tongue depressor.",
        "Say no more. If it's giving people meat, then I'm on board. I've always said Humans need more animal blood. It keeps the spine straight..",
        "Is Wario A Libertarian.",
        "see this watch? i got it by Crying. my car? crying. my beautiful wife? Crying. My perfect teeth? Crying.",
        "oh nothin, i was just buying some ear medication for my sick uncle...who's a Model by the way",
        "I went to buy some camouflage pants the other day but couldn't find any."
      ];
      
      const randomOpinion = mockOpinions[Math.floor(Math.random() * mockOpinions.length)];
      setOpinion(randomOpinion);
      setLastGenerated(randomOpinion);
      
      const updatedOpinions = [...allOpinions, randomOpinion];
      setAllOpinions(updatedOpinions);
      saveToLocalStorage(updatedOpinions);
      
      // Track this as AI-generated
      trackOpinionSource(randomOpinion, 'ai');
      
      // CRITICAL FIX: Clear realtimeDataService cache to force refresh
      if (typeof window !== 'undefined') {
        try {
          // Import and clear cache
          const { realtimeDataService } = await import('../lib/realtime-data-service');
          (realtimeDataService as any).cache = {}; // Clear the cache
          console.log('✅ RealtimeDataService cache cleared (fallback)');
        } catch (error) {
          console.error('Error clearing cache (fallback):', error);
        }
        
        // Method 1: Use the global refresh function
        if ((window as any).refreshSidebar) {
          (window as any).refreshSidebar();
          console.log('✅ Sidebar refresh triggered via global function (fallback)');
        }
        
        // Method 2: Dispatch custom event
        window.dispatchEvent(new CustomEvent('manualRefresh'));
        console.log('✅ Manual refresh event dispatched (fallback)');
        
        // Method 3: Dispatch storage-like event
        window.dispatchEvent(new CustomEvent('localStorageChange', {
          detail: { key: 'opinions', newValue: JSON.stringify(updatedOpinions) }
        }));
        console.log('✅ Local storage change event dispatched (fallback)');
      }
      
      // CRITICAL FIX: Track opinion generation using GlobalActivityTracker
      try {
        // Dynamically import to avoid breaking the main flow
        const { default: GlobalActivityTracker } = await import('../components/GlobalActivityTracker');
        await GlobalActivityTracker.trackOpinionGeneration(randomOpinion, false);
        console.log('✅ Opinion generation tracked via GlobalActivityTracker (fallback)');
      } catch (error) {
        console.error('Error tracking opinion generation:', error);
      }
    } finally {
      setLoading(false);
    }
  }, [allOpinions, saveToLocalStorage]);

  const submitUserOpinion = useCallback(async () => {
    if (userInput.trim() && userInput.length <= MAX_CHARS) {
      const trimmedInput = userInput.trim();
      
      const updatedOpinions = [...allOpinions, trimmedInput];
      setAllOpinions(updatedOpinions);
      saveToLocalStorage(updatedOpinions);
      
      // Track this as user-submitted
      trackOpinionSource(trimmedInput, 'user');
      
      // CRITICAL FIX: Clear realtimeDataService cache to force refresh
      if (typeof window !== 'undefined') {
        try {
          // Import and clear cache
          const { realtimeDataService } = await import('../lib/realtime-data-service');
          (realtimeDataService as any).cache = {}; // Clear the cache
          console.log('✅ RealtimeDataService cache cleared (user opinion)');
        } catch (error) {
          console.error('Error clearing cache (user opinion):', error);
        }
        
        // Method 1: Use the global refresh function
        if ((window as any).refreshSidebar) {
          (window as any).refreshSidebar();
          console.log('✅ Sidebar refresh triggered via global function (user opinion)');
        }
        
        // Method 2: Dispatch custom event
        window.dispatchEvent(new CustomEvent('manualRefresh'));
        console.log('✅ Manual refresh event dispatched (user opinion)');
        
        // Method 3: Dispatch storage-like event
        window.dispatchEvent(new CustomEvent('localStorageChange', {
          detail: { key: 'opinions', newValue: JSON.stringify(updatedOpinions) }
        }));
        console.log('✅ Local storage change event dispatched (user opinion)');
      }
      
      // CRITICAL FIX: Track user-submitted opinion properly
      try {
        const userProfile = JSON.parse(localStorage.getItem('userProfile') || '{}');
        const currentUser = userProfile.username || 'User';
        
        // Use GlobalActivityTracker to properly track user opinion generation
        try {
          // Dynamically import to avoid breaking the main flow
          const { default: GlobalActivityTracker } = await import('../components/GlobalActivityTracker');
          await GlobalActivityTracker.trackOpinionGeneration(trimmedInput, false);
          console.log('✅ User opinion generation tracked via GlobalActivityTracker');
        } catch (error) {
          console.error('Error tracking user opinion generation:', error);
        }
        
        // Also create transaction for backward compatibility
        const transaction = {
          id: Date.now().toString(),
          type: 'generate', // Changed from 'earn' to 'generate' for consistency
          opinionText: trimmedInput,
          amount: 0, // No monetary reward for submitting opinions
          date: new Date().toISOString(),
          description: 'User submitted opinion'
        };
        
        const existingTransactions = JSON.parse(localStorage.getItem('transactions') || '[]');
        const updatedTransactions = [transaction, ...existingTransactions];
        localStorage.setItem('transactions', JSON.stringify(updatedTransactions));
        
        console.log(`✅ User submitted opinion: "${trimmedInput.slice(0, 30)}..."`);
        console.log(`🔍 DEBUG: Created transaction:`, {
          id: transaction.id,
          type: transaction.type,
          opinionText: transaction.opinionText,
          description: transaction.description,
          date: transaction.date
        });
        
      } catch (error) {
        console.error('Error creating transaction for user-submitted opinion:', error);
      }
      
      setUserInput('');
      setOpinion(`Submitted: ${trimmedInput}`);
    }
  }, [userInput, allOpinions, MAX_CHARS, saveToLocalStorage]);

  return (
    <div className="page-container">
      <Sidebar opinions={sidebarOpinions} />
      
      <main className="main-content">
        <div className={styles.pageHeader}>
          <div className={styles.headerContent}>
            <h1 className={styles.headerTitle}>Opinion Generator</h1>
            <p className={styles.headerSubtitle}>
              Create and save opinions to trade in the marketplace
            </p>
          </div>
          
          {/* Navigation Buttons */}
          <div className={styles.headerActions}>
            <a href="/users" className="nav-button traders">
            <ScanSmiley size={24} />  View Traders
            </a>
            <a href="/feed" className="nav-button feed">
              <RssSimple size={24} /> Live Feed
            </a>
            <button 
              onClick={() => router.push('/profile')}
              className="nav-button traders"
            >
             <Wallet size={24} /> My Portfolio
            </button>
            <AuthButton />
          </div>
        </div>

        {/* Statistics Display */}
        <div className={styles.statsDisplay}>
          <div className={styles.statItem}>
            <p className={styles.statNumber}>{stats.totalOpinions}</p>
            <p className={styles.statLabel}>Total Opinions</p>
          </div>
          <div className={styles.statItem}>
            <p className={styles.statNumber}>{stats.generatedToday}</p>
            <p className={styles.statLabel}>Generated Today</p>
          </div>
          <div className={styles.statItem}>
            <p className={styles.statNumber}>{stats.draftReady}</p>
            <p className={styles.statLabel}>Draft Ready</p>
          </div>
        </div>

        {/* Random Generator Section */}
        <div className={`${styles.generatorSection} ${styles.randomGenerator}`}>
          <h2 className={styles.sectionTitle}>
          <PlayCircle size={32} />   Generate an Idea for Me
          </h2>
          
          <div className={styles.opinionDisplay}>
            <p className={`${styles.opinionText} ${loading ? styles.loading : ''}`}>
              {loading ? 'Generating opinion...' : opinion}
            </p>
          </div>
          
          <div className={styles.actionContainer}>
            <button
              onClick={generateOpinion}
              disabled={loading}
              className={styles.generateButton}
            >
              {loading && <div className={styles.loadingSpinner}></div>}
              {loading ? 'Generating...' : 'Generate New Opinion'}
            </button>
          </div>
        </div>

        {/* User Input Section */}
        <div className={`${styles.generatorSection} ${styles.userInput}`}>
          <h2 className={styles.sectionTitle}>
          <NotePencil size={32} />  Submit Your Idea
          </h2>
          
          <textarea
            value={userInput}
            onChange={(e) => setUserInput(e.target.value)}
            placeholder="Share your thoughts here... !"
            className={styles.textarea}
            maxLength={MAX_CHARS + 50} // Allow slight overflow for warning
          />
          
          <div className={`${styles.characterCounter} ${charCountClass}`}>
            {charCount}/{MAX_CHARS} characters
          </div>
          
          <div className={styles.actionContainer}>
            <button
              onClick={submitUserOpinion}
              disabled={!userInput.trim() || charCount > MAX_CHARS}
              className={styles.submitButton}
            >
              Submit Opinion
            </button>
          </div>
        </div>

        {/* Tips Section */}
        <div className={styles.tipsSection}>
          <p className={styles.tipsText}>
            <strong>Tip:</strong> All opinions are automatically saved 
            and appear in the sidebar. Click on any opinion in the sidebar to view it in detail 
            and start trading! The more unique and engaging your opinions, the more valuable they might become.
          </p>
        </div>
      </main>
    </div>
  );
}

export default GenerateOpinions;