// app/lib/autonomous-bots.ts (Firestore‑native rewrite)
// -----------------------------------------------------------------------------
// ✅ All browser‑only localStorage calls removed
// ✅ State persisted in Cloud Firestore (and kept in memory for perf)
// -----------------------------------------------------------------------------

import {
  collection,
  doc,
  getFirestore,
  getDocs,
  onSnapshot,
  setDoc,
  updateDoc,
  writeBatch,
  Timestamp,
} from 'firebase/firestore';
import { initializeApp, getApps } from 'firebase/app';

import {
  calculateUnifiedPrice,
  UnifiedMarketDataManager,
  UnifiedTransactionManager,
  type UnifiedOpinionMarketData,
  type UnifiedTransaction,
} from '../lib/unified-system';

import { firebaseConfig } from '../lib/firebase-config';

// -----------------------------------------------------------------------------
// 🔥 Firestore helpers
// -----------------------------------------------------------------------------
const app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);
export const db = getFirestore(app);

const colBots = collection(db, 'bots');              // ⇢ /bots/{botId}
const colBotPortfolios = collection(db, 'bot-portfolios'); // ⇢ /bot-portfolios/{botId}/{holdingId}
const colBotTransactions = collection(db, 'bot-transactions');

// -----------------------------------------------------------------------------
// 🔖 Types (trimmed – keep the ones we actually use below)
// -----------------------------------------------------------------------------
export interface BotProfile {
  id: string;
  username: string;
  balance: number;
  joinDate: string;
  totalEarnings: number;
  totalLosses: number;
  lastActive: string;
  isActive: boolean;
}

interface OpinionRef {
  id: string;
  text: string;
}

// -----------------------------------------------------------------------------
// 🤖  AutonomousBotSystem (Firestore edition)
// -----------------------------------------------------------------------------
class AutonomousBotSystem {
  private bots: Map<string, BotProfile> = new Map();
  private isRunning = false;
  private market = UnifiedMarketDataManager.getInstance();
  private txMgr = UnifiedTransactionManager.getInstance();
  private intervals: Record<string, NodeJS.Timeout> = {};

  // ----------------------------------------------------------------------------
  // 🚀 Boot
  // ----------------------------------------------------------------------------
  constructor() {
    this.bootstrap();
  }

  /** bootstrap – initial fetch + live listeners */
  private async bootstrap() {
    // 1️⃣ prime from Firestore once
    const snap = await getDocs(colBots);
    snap.forEach(d => this.bots.set(d.id, d.data() as BotProfile));

    // 2️⃣ live updates – keep local cache fresh
    onSnapshot(colBots, qs => {
      qs.docChanges().forEach(c => {
        if (c.type === 'removed') this.bots.delete(c.doc.id);
        else this.bots.set(c.doc.id, c.doc.data() as BotProfile);
      });
    });

    // 🏃‍♂️ start after cache is warm
    this.start();
  }

  // ----------------------------------------------------------------------------
  // ▶️  start / ⏹  stop
  // ----------------------------------------------------------------------------
  public start() {
    if (this.isRunning) return;
    this.isRunning = true;
    console.log('🤖  Bot system started');

    // spin each active bot on its own timer
    [...this.bots.values()].forEach(bot => {
      if (!bot.isActive) return;
      const ms = 60_000 + Math.random() * 60_000; // 1‑2 min
      this.intervals[bot.id] = setInterval(() => this.tick(bot), ms);
    });
  }

  public stop() {
    Object.values(this.intervals).forEach(clearInterval);
    this.intervals = {};
    this.isRunning = false;
  }

  // ----------------------------------------------------------------------------
  // 🕐  tick – one decision loop
  // ----------------------------------------------------------------------------
  private async tick(bot: BotProfile) {
    // pick a random opinion (mock – replace with your selector)
    const opinions: OpinionRef[] = this.market.getAllOpinionRefs();
    if (!opinions.length) return;
    const op = opinions[Math.floor(Math.random() * opinions.length)];

    // decide action (simple buy‑only demo)
    await this.buyOpinion(bot, op, 1);
  }

  // ----------------------------------------------------------------------------
  // 💸  buyOpinion (Firestore write)
  // ----------------------------------------------------------------------------
  private async buyOpinion(bot: BotProfile, op: OpinionRef, qty: number) {
    const price = this.market.getMarketData(op.text).currentPrice;
    const total = price * qty;
    if (bot.balance < total) return;

    // update bot balance in RAM & Firestore
    bot.balance -= total;
    bot.lastActive = new Date().toISOString();
    await updateDoc(doc(colBots, bot.id), {
      balance: bot.balance,
      lastActive: bot.lastActive,
    });

    // portfolio ➜ /bot-portfolios/{botId}/{opId}
    await setDoc(
      doc(colBotPortfolios, `${bot.id}_${op.id}`),
      {
        botId: bot.id,
        opinionId: op.id,
        opinionText: op.text,
        qty: qty,
        avgPrice: price,
        updatedAt: Timestamp.now(),
      },
      { merge: true }
    );

    // market move (unified system)
    this.market.updateMarketData(op.text, 'buy', qty, price, bot.id);

    // tx log ➜ /bot-transactions
    this.txMgr.saveTransaction({
      type: 'buy',
      amount: -total,
      opinionText: op.text,
      opinionId: op.id,
      botId: bot.id,
      price,
      quantity: qty,
    } as unknown as UnifiedTransaction);

    console.log(`🤖 ${bot.username} bought ${qty}x "${op.text.slice(0, 30)}…" ($${total.toFixed(2)})`);
  }
}

// -----------------------------------------------------------------------------
// 🌍 Export singleton (for debug via browser console)
// -----------------------------------------------------------------------------
export const botSystem = new AutonomousBotSystem();
if (typeof window !== 'undefined') (window as any).botSystem = botSystem;
