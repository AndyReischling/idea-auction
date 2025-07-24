'use client';

import { useEffect, useState, useMemo, useCallback } from 'react';
import Sidebar from '../components/Sidebar';
import Header from '../components/ui/Header';
import styles from './page.module.css';
import { ScanSmiley } from '@phosphor-icons/react/dist/icons/ScanSmiley';
import { RssSimple } from '@phosphor-icons/react/dist/icons/RssSimple';
import { Wallet } from '@phosphor-icons/react/dist/icons/Wallet';
import { NotePencil } from '@phosphor-icons/react/dist/icons/NotePencil';
import { PlayCircle } from '@phosphor-icons/react/dist/icons/PlayCircle';
import AuthButton from '../components/AuthButton';
import AuthStatusIndicator from '../components/AuthStatusIndicator';
import Navigation from '../components/Navigation';
import { useRouter } from 'next/navigation';

// Firebase
import {
  collection,
  addDoc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { getAuth } from 'firebase/auth';
import { opinionConflictResolver } from '../lib/opinion-conflict-resolver';
import { createMarketDataDocId } from '../lib/document-id-utils';

/**
 * The Opinion page expects each document to expose:
 *  - text          (string)
 *  - source        ('user' | 'bot_generated')
 *  - authorId      (string | null)
 *  - author        (string)
 *  - createdAt     (Timestamp)
 *  - updatedAt     (Timestamp)
 *  - isBot         (boolean)  // helper flag for convenience
 *
 * We save exactly those fields here.
 */
type SourceType = 'user' | 'bot_generated';

const useFirestoreOpinionWriter = () => {
  const auth = getAuth();

  return useCallback(
    async (text: string, source: SourceType) => {
      if (!text.trim()) return;
      try {
        const user = auth.currentUser;
        const opinionData = {
          text: text.trim(),
          source, // aligns with OpinionPage expectations
          isBot: source === 'bot_generated',
          authorId: user ? user.uid : null,
          author: user ? user.displayName || user.email || 'Anonymous' : 'Anonymous',
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        };

        // Use consistent ID generation and conflict resolution
        const opinionId = createMarketDataDocId(text.trim());
        await opinionConflictResolver.safeCreateOpinion(
          opinionId,
          opinionData,
          `create opinion: ${text.trim().slice(0, 30)}...`
        );
      } catch (err) {
        console.error('❌ Failed to save opinion to Firestore', err);
        throw err; // Re-throw to let caller handle
      }
    },
    [auth]
  );
};

function GenerateOpinions() {
  const [opinion, setOpinion] = useState('Click the button to generate an opinion!');
  const [userInput, setUserInput] = useState('');
  const [allOpinions, setAllOpinions] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [lastGenerated, setLastGenerated] = useState<string>('');

  const router = useRouter();
  const MAX_CHARS = 500;

  /* ------------------------------------------------------------------
   * Live subscription – only for stats; Sidebar handles its own list.
   * ------------------------------------------------------------------ */
  useEffect(() => {
    const q = query(collection(db, 'opinions'), orderBy('createdAt', 'desc'));
    const unsub = onSnapshot(q, (snap) => {
      setAllOpinions(snap.docs.map((d) => (d.data().text as string) || ''));
    });
    return () => unsub();
  }, []);

  /* ------------------------------------------------------------------
   * Derived helpers
   * ------------------------------------------------------------------ */
  const charCount = userInput.length;

  const stats = useMemo(
    () => ({
      totalOpinions: allOpinions.length,
      generatedToday: lastGenerated ? 1 : 0,
      draftReady: userInput.trim() ? 1 : 0,
    }),
    [allOpinions.length, lastGenerated, userInput]
  );

  const charCountClass = useMemo(() => {
    if (charCount > MAX_CHARS) return styles.error;
    if (charCount > MAX_CHARS * 0.8) return styles.warning;
    return '';
  }, [charCount]);

  const saveOpinion = useFirestoreOpinionWriter();

  /* ------------------------------------------------------------------
   * AI opinion generator – saves with source = 'bot_generated'
   * ------------------------------------------------------------------ */
  const generateOpinion = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/generate', { method: 'POST' });
      if (!res.ok) throw new Error('Generate failed');
      const { opinion: newOpinion } = await res.json();
      setOpinion(newOpinion);
      setLastGenerated(newOpinion);
      await saveOpinion(newOpinion, 'bot_generated');
    } catch (err) {
      console.error(err);
      // ❌ HARDCODED OPINION ELIMINATED: No fallback mock opinions
      setOpinion('❌ Opinion generation failed - please check your OpenAI API configuration');
      setLastGenerated('');
      // Don't save failed generations to Firestore
    } finally {
      setLoading(false);
    }
  }, [saveOpinion]);

  /* ------------------------------------------------------------------
   * User‑submitted opinion handler – source = 'user'
   * ------------------------------------------------------------------ */
  const submitUserOpinion = useCallback(async () => {
    const trimmed = userInput.trim();
    if (!trimmed || trimmed.length > MAX_CHARS) return;
    setOpinion(`Submitted: ${trimmed}`);
    setUserInput('');
    await saveOpinion(trimmed, 'user');
  }, [userInput, saveOpinion]);

  /* ------------------------------------------------------------------
   * Render
   * ------------------------------------------------------------------ */
  return (
    <div className="page-container">
      <Header hideNavigation={['generate']} />
      <Sidebar />

      <main className="main-content" style={{ paddingTop: '40px' }}>
        {/* Stats */}
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

        {/* AI Generator */}
        <div className={`${styles.generatorSection} ${styles.randomGenerator}`}>
          <h2 className={styles.sectionTitle}>
            <PlayCircle size={32} /> Generate an Idea for Me
          </h2>
          <div className={styles.opinionDisplay}>
            <p className={`${styles.opinionText} ${loading ? styles.loading : ''}`}>
              {loading ? 'Generating opinion...' : opinion}
            </p>
          </div>
          <div className={styles.actionContainer}>
            <button onClick={generateOpinion} disabled={loading} className={styles.generateButton}>
              {loading && <div className={styles.loadingSpinner}></div>}
              {loading ? 'Generating...' : 'Generate New Opinion'}
            </button>
          </div>
        </div>

        {/* User Input */}
        <div className={`${styles.generatorSection} ${styles.userInput}`}>
          <h2 className={styles.sectionTitle}>
            <NotePencil size={32} /> Submit Your Idea
          </h2>
          <textarea
            value={userInput}
            onChange={(e) => setUserInput(e.target.value)}
            placeholder="Share your thoughts here... !"
            className={styles.textarea}
            maxLength={MAX_CHARS + 50}
          />
          <div className={`${styles.characterCounter} ${charCountClass}`}>{charCount}/{MAX_CHARS} characters</div>
          <div className={styles.actionContainer}>
            <button onClick={submitUserOpinion} disabled={!userInput.trim() || charCount > MAX_CHARS} className={styles.submitButton}>
              Submit Opinion
            </button>
          </div>
        </div>

        {/* Tip */}
        <div className={styles.tipsSection}>
          <p className={styles.tipsText}>
            <strong>Tip:</strong> All opinions are saved with full metadata (author, timestamps, source) and appear in the sidebar & individual pages in real time.
          </p>
        </div>
      </main>
    </div>
  );
}

export default GenerateOpinions;
