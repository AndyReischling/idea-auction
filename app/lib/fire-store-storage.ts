import {
    doc,
    getDoc,
    setDoc,
    updateDoc,
    increment,
    collection,
    query,
    where,
    getDocs,
    Timestamp,
  } from 'firebase/firestore';
  import { db } from './firebase';          // ← your singleton
  
  /** Generic “get” that mirrors the old safeGetFromStorage */
  export async function fsGet<T = any>(
    key: string,
    defaultValue: T | null = null,
  ): Promise<T | null> {
    try {
      const snap = await getDoc(doc(db, 'browser-cache', key));
      return snap.exists() ? (snap.data().payload as T) : defaultValue;
    } catch (err) {
      console.error(`Firestore read failed for ${key}`, err);
      return defaultValue;
    }
  }
  
  /** Generic “set” that mirrors the old safeSetToStorage */
  export async function fsSet(key: string, value: any) {
    try {
      await setDoc(
        doc(db, 'browser-cache', key),
        { payload: value, updatedAt: Timestamp.now() },
        { merge: true },
      );
    } catch (err) {
      console.error(`Firestore write failed for ${key}`, err);
    }
  }
  
  /** Opinion-level stats collection (`opinionMarketData`) */
  export async function incOpinionMetric(
    opinionText: string,
    field: 'timesPurchased' | 'timesSold',
  ) {
    const ref = doc(db, 'market-data', opinionText);
    await setDoc(ref, { [field]: increment(1) }, { merge: true });
  }
  
  /** Rapid-trade counter (10-min window) */
  export async function countRapidTrades(opinionText: string): Promise<number> {
    const tenMinAgo = Timestamp.fromMillis(Date.now() - 10 * 60 * 1000);
    const q = query(
      collection(db, 'transactions'),
      where('opinionText', '==', opinionText),
      where('type', '==', 'buy'),
      where('timestamp', '>=', tenMinAgo),
    );
    const snap = await getDocs(q);
    return snap.size;
  }
  