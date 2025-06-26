'use client';

import { useEffect, useState } from 'react';
import Sidebar from '../components/Sidebar';
import '../global.css';
import styles from './page.module.css';

function GenerateOpinions() {
  const [opinion, setOpinion] = useState('Click the button to generate an opinion!');
  const [userInput, setUserInput] = useState('');
  const [allOpinions, setAllOpinions] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [charCount, setCharCount] = useState(0);
  const [lastGenerated, setLastGenerated] = useState<string>('');

  const MAX_CHARS = 500;

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

  useEffect(() => {
    setCharCount(userInput.length);
  }, [userInput]);

  const generateOpinion = async () => {
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
      localStorage.setItem('opinions', JSON.stringify(updatedOpinions));
      
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
      localStorage.setItem('opinions', JSON.stringify(updatedOpinions));
    } finally {
      setLoading(false);
    }
  };

  const submitUserOpinion = () => {
    if (userInput.trim() && userInput.length <= MAX_CHARS) {
      const trimmedInput = userInput.trim();
      
      const updatedOpinions = [...allOpinions, trimmedInput];
      setAllOpinions(updatedOpinions);
      localStorage.setItem('opinions', JSON.stringify(updatedOpinions));
      
      setUserInput('');
      setOpinion(`Submitted: ${trimmedInput}`);
      setCharCount(0);
    }
  };

  const getCharCountClass = () => {
    if (charCount > MAX_CHARS) return styles.error;
    if (charCount > MAX_CHARS * 0.8) return styles.warning;
    return '';
  };

  return (
    <div className="page-container">
      <Sidebar opinions={allOpinions.map((text, i) => ({ id: i.toString(), text: text || '' }))} />
      
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
              📊 View Traders
            </a>
            <a href="/feed" className="nav-button feed">
              📡 Live Feed
            </a>
            <a href="/" className="nav-button traders">
              ← Back to Profile
            </a>
          </div>
        </div>

        {/* Statistics Display */}
        <div className={styles.statsDisplay}>
          <div className={styles.statItem}>
            <p className={styles.statNumber}>{allOpinions.length}</p>
            <p className={styles.statLabel}>Total Opinions</p>
          </div>
          <div className={styles.statItem}>
            <p className={styles.statNumber}>{lastGenerated ? '1' : '0'}</p>
            <p className={styles.statLabel}>Generated Today</p>
          </div>
          <div className={styles.statItem}>
            <p className={styles.statNumber}>{userInput.trim() ? '1' : '0'}</p>
            <p className={styles.statLabel}>Draft Ready</p>
          </div>
        </div>

        {/* Random Generator Section */}
        <div className={`${styles.generatorSection} ${styles.randomGenerator}`}>
          <h2 className={styles.sectionTitle}>
            🎲 Random Opinion Generator
          </h2>
          
          <div className={styles.opinionDisplay}>
            <p className={`${styles.opinionText} ${loading ? styles.loading : ''}`}>
              {loading ? 'Generating witty opinion...' : opinion}
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
            ✍️ Submit Your Opinion
          </h2>
          
          <textarea
            value={userInput}
            onChange={(e) => setUserInput(e.target.value)}
            placeholder="What's your opinion on something? Share your thoughts here... Be creative, controversial, or just plain weird!"
            className={styles.textarea}
            maxLength={MAX_CHARS + 50} // Allow slight overflow for warning
          />
          
          <div className={`${styles.characterCounter} ${getCharCountClass()}`}>
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