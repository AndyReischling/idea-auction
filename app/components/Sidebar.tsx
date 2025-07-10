'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import styles from './Sidebar.module.css';
import { Lightbulb } from '@phosphor-icons/react';
import {
  collection,
  onSnapshot,
  orderBy,
  query,
  Timestamp,
} from 'firebase/firestore';
import { db } from '../lib/firebase';

/**
 * Firestore opinion document shape.
 */
interface OpinionDoc {
  id: string;
  text: string;
  createdAt: number; // epoch ms for easy sorting
  source?: 'ai' | 'user';
}

/**
 * Sidebar lists every opinion in the **opinions** collection, newest first.
 * All legacy local‑storage / realtimeDataService logic has been removed.
 */
function Sidebar() {
  const [opinions, setOpinions] = useState<OpinionDoc[]>([]);
  const [loading, setLoading] = useState(true);

  /* ------------------------------------------------------------------
   * Subscribe to Firestore in real‑time.
   * ------------------------------------------------------------------ */
  useEffect(() => {
    const opinionsRef = collection(db, 'opinions');
    const q = query(opinionsRef, orderBy('createdAt', 'desc'));

    const unsubscribe = onSnapshot(q, (snap) => {
      const docs: OpinionDoc[] = snap.docs.map((d) => {
        const data = d.data();
        const ts = data.createdAt as Timestamp | undefined;
        return {
          id: d.id,
          text: data.text ?? '',
          createdAt: ts ? ts.toMillis() : Date.now(),
          source: data.source as 'ai' | 'user',
        };
      });
      setOpinions(docs);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  /* ------------------------------------------------------------------
   * Render helpers.
   * ------------------------------------------------------------------ */
  const attributionBadge = (source?: 'ai' | 'user') => (
    <div className={`${styles.attributionBadge} ${styles[source ?? 'user']}`}>
      {source === 'ai' ? 'AI' : 'User'}
    </div>
  );

  /* ------------------------------------------------------------------
   * JSX
   * ------------------------------------------------------------------ */
  return (
    <aside className={styles.sidebar}>
      {/* Header */}
      <div className={styles.sidebarHeader}>
        <h2 className={styles.headerTitle}>Hot Talk</h2>
        <p className={styles.headerSubtitle}>A Dr. Hollywood Production</p>
        <div style={{ marginTop: '2.5rem' }}>
          <Link href="/feed" className={styles.liveFeedLink}>
            <span className={styles.lightbulbPulse}>
              <Lightbulb size={24} />
            </span>
            Opinions List
          </Link>
        </div>
      </div>

      <div className={styles.scrollArea}>
        {/* Loading */}
        {loading && (
          <div className={styles.loadingState}>
            <div className={styles.loadingSpinner}></div>
            <p>Loading opinions...</p>
          </div>
        )}

        {/* Empty */}
        {!loading && opinions.length === 0 && (
          <div className={styles.emptyState}>
            <p>📭</p>
            <p>No opinions yet. Generate or submit one!</p>
          </div>
        )}

        {/* Opinion list */}
        {!loading && opinions.length > 0 && (
          <ul className={styles.opinionList}>
            {opinions.map((op) => (
              <li key={op.id} className={styles.opinionItem}>
                <Link href={`/opinion/${op.id}`} className={styles.opinionLink}>
                  <div className={styles.opinionContent}>
                    <div className={styles.opinionTextSection}>
                      <div className={styles.opinionText}>
                        {op.text.slice(0, 45)}
                        {op.text.length > 45 && '…'}
                      </div>
                      {attributionBadge(op.source)}
                    </div>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </aside>
  );
}

export default Sidebar;
