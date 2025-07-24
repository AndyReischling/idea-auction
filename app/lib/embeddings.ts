import OpenAI from 'openai';
import { doc, getDoc, setDoc, deleteDoc } from 'firebase/firestore';
import { db, auth } from './firebase';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY!,
});

export interface EmbeddingData {
  id: string;
  text: string;
  embedding: number[];
  type: 'opinion' | 'user' | 'activity' | 'transaction';
  metadata: Record<string, any>;
  createdAt: string;
}

/**
 * Singleton service that manages embeddings.
 *
 * 1. Generates embeddings via OpenAI
 * 2. Caches them in memory (Map<id, EmbeddingData>) for the session
 * 3. Persists the cache in **Firestore** under `embeddings/{uid}`
 */
export class EmbeddingService {
  private static instance: EmbeddingService;
  private embeddings: Map<string, EmbeddingData> = new Map();

  // ─────────────────────────────────────────────────────────────
  // ⚙️  Singleton access
  // ─────────────────────────────────────────────────────────────
  static getInstance(): EmbeddingService {
    if (!EmbeddingService.instance) {
      EmbeddingService.instance = new EmbeddingService();
    }
    return EmbeddingService.instance;
  }

  private constructor() {
    // fire‑and‑forget; no need to await in the ctor
    this.loadEmbeddings();
  }

  // ─────────────────────────────────────────────────────────────
  // 🔮 OpenAI helpers
  // ─────────────────────────────────────────────────────────────
  async generateEmbedding(text: string): Promise<number[]> {
    const response = await openai.embeddings.create({
      model: 'text-embedding-ada-002',
      input: text.replace(/\n/g, ' ').trim(),
    });
    return response.data[0].embedding;
  }

  // ─────────────────────────────────────────────────────────────
  // 📌 CRUD
  // ─────────────────────────────────────────────────────────────
  async addEmbedding(
    id: string,
    text: string,
    type: EmbeddingData['type'],
    metadata: Record<string, any> = {}
  ): Promise<void> {
    const embedding = await this.generateEmbedding(text);
    const embeddingData: EmbeddingData = {
      id,
      text,
      embedding,
      type,
      metadata,
      createdAt: new Date().toISOString(),
    };

    this.embeddings.set(id, embeddingData);
    await this.saveEmbeddings();
    console.log(`✅ Added embedding → ${type}: ${id}`);
  }

  async searchSimilar(
    query: string,
    limit = 10,
    typeFilter?: EmbeddingData['type']
  ): Promise<Array<EmbeddingData & { similarity: number }>> {
    const queryEmbedding = await this.generateEmbedding(query);
    const results: Array<EmbeddingData & { similarity: number }> = [];

    for (const [, embeddingData] of this.embeddings) {
      if (typeFilter && embeddingData.type !== typeFilter) continue;
      const sim = this.cosineSimilarity(queryEmbedding, embeddingData.embedding);
      results.push({ ...embeddingData, similarity: sim });
    }

    return results.sort((a, b) => b.similarity - a.similarity).slice(0, limit);
  }

  getEmbeddingCount(): number {
    return this.embeddings.size;
  }

  async clearEmbeddings(): Promise<void> {
    this.embeddings.clear();
    const uid = auth.currentUser?.uid;
    if (uid) {
      try {
        await deleteDoc(doc(db, 'embeddings', uid));
      } catch (err) {
        console.error('Error deleting embeddings doc:', err);
      }
    }
  }

  // ─────────────────────────────────────────────────────────────
  // 🧮 Helpers
  // ─────────────────────────────────────────────────────────────
  private cosineSimilarity(a: number[], b: number[]): number {
    if (a.length !== b.length) return 0;
    let dot = 0,
      normA = 0,
      normB = 0;
    for (let i = 0; i < a.length; i++) {
      dot += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }
    const denom = Math.sqrt(normA) * Math.sqrt(normB);
    return denom === 0 ? 0 : dot / denom;
  }

  // ─────────────────────────────────────────────────────────────
  // ☁️ Firestore persistence
  // ─────────────────────────────────────────────────────────────
  private async loadEmbeddings(): Promise<void> {
    const uid = auth.currentUser?.uid;
    if (!uid) return; // user not signed in yet

    try {
      const snap = await getDoc(doc(db, 'embeddings', uid));
      if (snap.exists()) {
        const vectors = snap.data().vectors as Record<string, EmbeddingData>;
        this.embeddings = new Map(Object.entries(vectors));
        console.log(`📚 Loaded ${this.embeddings.size} embeddings from Firestore`);
      }
    } catch (err) {
      console.error('Error loading embeddings from Firestore:', err);
    }
  }

  private async saveEmbeddings(): Promise<void> {
    const uid = auth.currentUser?.uid;
    if (!uid) return;

    try {
      await setDoc(
        doc(db, 'embeddings', uid),
        { vectors: Object.fromEntries(this.embeddings) },
        { merge: true }
      );
    } catch (err) {
      console.error('Error saving embeddings to Firestore:', err);
    }
  }

  // ─────────────────────────────────────────────────────────────
  // 🔄 Batch add for large datasets (respects rate limits)
  // ─────────────────────────────────────────────────────────────
  async batchAddEmbeddings(items: Array<{
    id: string;
    text: string;
    type: EmbeddingData['type'];
    metadata?: Record<string, any>;
  }>): Promise<void> {
    console.log(`🔄 Processing ${items.length} items for embedding…`);
    for (let i = 0; i < items.length; i++) {
      const { id, text, type, metadata } = items[i];
      try {
        await this.addEmbedding(id, text, type, metadata);
        // naive rate‑limit guard: pause every 10 calls
        if (i > 0 && i % 10 === 0) await new Promise(r => setTimeout(r, 1000));
      } catch (err) {
        console.error(`Failed to embed ${id}:`, err);
      }
    }
    console.log('✅ Completed batch embedding');
  }
}
