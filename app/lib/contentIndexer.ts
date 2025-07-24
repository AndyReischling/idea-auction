import {
  collection,
  getDocs,
  query,
  where,
  orderBy,
  limit,
  Timestamp,
} from 'firebase/firestore';
import { db } from './firebase';
import { EmbeddingService } from './embeddings';

/**
 * ContentIndexer (Firestore‑native)
 * ---------------------------------------------------------------------------
 * Indexes *all* public‑facing content into the vector store. 100 % Firestore –
 * no trace of `localStorage` remains. Every helper now performs a live read
 * against the relevant collection instead of poking the browser.
 */
export class ContentIndexer {
  private embeddingService: EmbeddingService;

  constructor() {
    this.embeddingService = EmbeddingService.getInstance();
  }

  /**
   * Kick off a full re‑index. Runs the individual jobs in parallel.
   */
  async indexAllContent(): Promise<void> {
    console.log('🚀 Starting comprehensive content indexing…');

    await Promise.all([
      this.indexOpinions(),
      this.indexUserProfiles(),
      this.indexActivityFeed(),
      this.indexTransactions(),
    ]);

    console.log('✅ Content indexing completed!');
  }

  // ---------------------------------------------------------------------------
  // 🔎  Opinions
  // ---------------------------------------------------------------------------
  private async getOpinions(): Promise<Array<{ id: string; text: string }>> {
    const snap = await getDocs(collection(db, 'opinions'));
    return snap.docs.map((d) => ({ id: d.id, text: (d.data() as any).opinionText || '' }));
  }

  async indexOpinions(): Promise<void> {
    try {
      const opinions = await this.getOpinions();

      const items = opinions.map((op, i) => ({
        id: op.id,
        text: op.text,
        type: 'opinion' as const,
        metadata: {
          firestoreId: op.id,
          url: `/opinion/${op.id}`,
          category: 'opinion',
          length: op.text.length,
          wordCount: op.text.split(' ').length,
          indexedAt: Timestamp.now().toMillis(),
        },
      }));

      if (items.length) {
        await this.embeddingService.batchAddEmbeddings(items);
      }

      console.log(`📝 Indexed ${items.length} opinions`);
    } catch (err) {
      console.error('Error indexing opinions:', err);
    }
  }

  // ---------------------------------------------------------------------------
  // 👤  User profiles
  // ---------------------------------------------------------------------------
  private async getUsers(): Promise<Array<{ uid: string; username: string; balance: number }>> {
    const snap = await getDocs(collection(db, 'users'));
    return snap.docs.map((d) => {
      const data = d.data() as any;
      return {
        uid: d.id,
        username: data.username || 'User',
        balance: data.balance ?? 0,
      };
    });
  }

  private async getUserPortfolio(uid: string): Promise<any[]> {
    // Portfolios are stored as 1‑doc per user: `/user-portfolios/{uid}`
    try {
      const docSnap = await getDocs(
        query(collection(db, 'user-portfolios'), where('uid', '==', uid), limit(1))
      );
      if (docSnap.empty) return [];
      const holdings = (docSnap.docs[0].data() as any).holdings || [];
      return holdings;
    } catch {
      return [];
    }
  }

  async indexUserProfiles(): Promise<void> {
    try {
      const users = await this.getUsers();
      const items = [] as any[];

      for (const user of users) {
        const portfolio = await this.getUserPortfolio(user.uid);
        const portfolioNames = portfolio.map((p: any) => p.opinionText || p.text).join(', ');
        const portfolioValue = portfolio.reduce(
          (sum: number, p: any) => sum + ((p.currentPrice || 0) * (p.quantity || 0)),
          0
        );

        const searchText = [
          `User: ${user.username}`,
          portfolioNames ? `Owns opinions: ${portfolioNames}` : 'No opinions owned',
          `Portfolio value: $${portfolioValue.toFixed(2)}`,
          `Balance: $${user.balance?.toFixed?.(2) ?? user.balance}`,
        ].join('. ');

        items.push({
          id: `user_${user.uid}`,
          text: searchText,
          type: 'user' as const,
          metadata: {
            uid: user.uid,
            username: user.username,
            balance: user.balance,
            portfolioSize: portfolio.length,
            portfolioValue,
            url: `/users/${user.username}`,
            indexedAt: Timestamp.now().toMillis(),
          },
        });
      }

      if (items.length) {
        await this.embeddingService.batchAddEmbeddings(items);
      }

      console.log(`👥 Indexed ${items.length} user profiles`);
    } catch (err) {
      console.error('Error indexing user profiles:', err);
    }
  }

  // ---------------------------------------------------------------------------
  // 📡  Activity Feed
  // ---------------------------------------------------------------------------
  private async getActivityFeed(): Promise<any[]> {
    const q = query(collection(db, 'activity-feed'), orderBy('timestamp', 'desc'));
    const snap = await getDocs(q);
    return snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) }));
  }

  async indexActivityFeed(): Promise<void> {
    try {
      const activities = await this.getActivityFeed();
      const items = activities
        .filter((a) => a.opinionText)
        .map((a) => {
          const activityText = [
            `${a.username} ${a.type}`,
            a.opinionText,
            a.amount ? `Amount: $${a.amount}` : '',
            a.price ? `Price: $${a.price}` : '',
          ]
            .filter(Boolean)
            .join('. ');

          return {
            id: `activity_${a.id}`,
            text: activityText,
            type: 'activity' as const,
            metadata: {
              userId: a.username,
              activityType: a.type,
              amount: a.amount,
              price: a.price,
              timestamp: a.timestamp,
              isBot: a.isBot || false,
              opinionId: a.opinionId,
              indexedAt: Timestamp.now().toMillis(),
            },
          };
        });

      if (items.length) {
        await this.embeddingService.batchAddEmbeddings(items);
      }

      console.log(`📊 Indexed ${items.length} activities`);
    } catch (err) {
      console.error('Error indexing activities:', err);
    }
  }

  // ---------------------------------------------------------------------------
  // 💸  Transactions (user + bot)
  // ---------------------------------------------------------------------------
  private async getTransactions(isBot: boolean | null = null): Promise<any[]> {
    const base = collection(db, 'transactions');
    // Removed isBot filtering - transactions documents don't have this field
    const q = base;
    const snap = await getDocs(q);
    return snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) }));
  }

  async indexTransactions(): Promise<void> {
    try {
      // Get all transactions since isBot field doesn't exist in documents
      const allTx = await this.getTransactions();

      const items = allTx
        .filter((t) => t.opinionText)
        .map((t) => {
          const transactionText = [
            `Transaction: ${t.type}`,
            t.opinionText,
            `Amount: $${t.amount}`,
            `Date: ${t.date || t.timestamp}`,
            t.isBot ? 'Bot transaction' : 'User transaction',
          ].join('. ');

          return {
            id: `transaction_${t.id}`,
            text: transactionText,
            type: 'transaction' as const,
            metadata: {
              transactionType: t.type,
              amount: t.amount,
              date: t.date || t.timestamp,
              opinionId: t.opinionId,
              isBot: t.isBot,
              botId: t.botId,
              indexedAt: Timestamp.now().toMillis(),
            },
          };
        });

      if (items.length) {
        await this.embeddingService.batchAddEmbeddings(items);
      }

      console.log(`💰 Indexed ${items.length} transactions`);
    } catch (err) {
      console.error('Error indexing transactions:', err);
    }
  }
}
