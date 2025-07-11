/* eslint-disable @typescript-eslint/explicit-module-boundary-types */
import {
  collection,
  collectionGroup,
  query,
  where,
  orderBy,
  limit as flimit,
  doc,
  getDoc,
  getDocs,
  writeBatch,
  increment,
  serverTimestamp,
  onSnapshot,
  QueryConstraint,
  Timestamp,
  FirestoreDataConverter,
} from 'firebase/firestore';
import { db } from './firebase';

/* ———————————————————————————————————————————————— */
/*  🔖 Domain types (only new ones shown)          */
/* ———————————————————————————————————————————————— */
export interface MarketCounters {
  timesPurchased?: number;
  timesSold?: number;
}

/* ———————————————————————————————————————————————— */
/*  🔧 Helper utils                                */
/* ———————————————————————————————————————————————— */
function safeToDate(v: any): Date {
  if (!v) return new Date();
  if (v instanceof Date) return v;
  if (typeof v === 'object' && 'toDate' in v) return (v as any).toDate();
  const d = new Date(v);
  return isNaN(d.getTime()) ? new Date() : d;
}

async function commitInChunks(
  batches: Array<ReturnType<typeof writeBatch>>,
): Promise<void> {
  for (const b of batches) await b.commit();
}

/* ———————————————————————————————————————————————— */
/*  👤  User helpers                               */
/* ———————————————————————————————————————————————— */
export async function getUserByUsername(username: string) {
  const q = query(
    collection(db, 'users'),
    where('username', '==', username),
    flimit(1),
  );
  const snap = await getDocs(q);
  return snap.empty ? null : { id: snap.docs[0].id, ...snap.docs[0].data() };
}

export function listenToUserProfile(
  uid: string,
  cb: (data: any | null) => void,
) {
  return onSnapshot(doc(db, 'us
