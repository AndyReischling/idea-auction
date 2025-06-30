import OpenAI from 'openai';

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

export class EmbeddingService {
  private static instance: EmbeddingService;
  private embeddings: Map<string, EmbeddingData> = new Map();

  static getInstance(): EmbeddingService {
    if (!EmbeddingService.instance) {
      EmbeddingService.instance = new EmbeddingService();
    }
    return EmbeddingService.instance;
  }

  constructor() {
    this.loadEmbeddings();
  }

  async generateEmbedding(text: string): Promise<number[]> {
    try {
      const response = await openai.embeddings.create({
        model: "text-embedding-ada-002",
        input: text.replace(/\n/g, ' ').trim(),
      });
      return response.data[0].embedding;
    } catch (error) {
      console.error('Error generating embedding:', error);
      throw error;
    }
  }

  async addEmbedding(
    id: string,
    text: string,
    type: EmbeddingData['type'],
    metadata: Record<string, any> = {}
  ): Promise<void> {
    try {
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
      this.saveEmbeddings();
      
      console.log(`✅ Added embedding for ${type}: ${id}`);
    } catch (error) {
      console.error(`Failed to add embedding for ${id}:`, error);
    }
  }

  async searchSimilar(
    query: string,
    limit: number = 10,
    typeFilter?: EmbeddingData['type']
  ): Promise<Array<EmbeddingData & { similarity: number }>> {
    try {
      const queryEmbedding = await this.generateEmbedding(query);
      const results: Array<EmbeddingData & { similarity: number }> = [];

      for (const [id, embeddingData] of this.embeddings) {
        // Apply type filter if specified
        if (typeFilter && embeddingData.type !== typeFilter) {
          continue;
        }

        const similarity = this.cosineSimilarity(queryEmbedding, embeddingData.embedding);
        results.push({
          ...embeddingData,
          similarity,
        });
      }

      // Sort by similarity (highest first) and limit results
      return results
        .sort((a, b) => b.similarity - a.similarity)
        .slice(0, limit);
    } catch (error) {
      console.error('Search error:', error);
      return [];
    }
  }

  private cosineSimilarity(vecA: number[], vecB: number[]): number {
    if (vecA.length !== vecB.length) return 0;
    
    let dotProduct = 0;
    let normA = 0;
    let normB = 0;
    
    for (let i = 0; i < vecA.length; i++) {
      dotProduct += vecA[i] * vecB[i];
      normA += vecA[i] * vecA[i];
      normB += vecB[i] * vecB[i];
    }
    
    const magnitude = Math.sqrt(normA) * Math.sqrt(normB);
    return magnitude === 0 ? 0 : dotProduct / magnitude;
  }

  private loadEmbeddings(): void {
    if (typeof window !== 'undefined') {
      try {
        const stored = localStorage.getItem('semanticEmbeddings');
        if (stored) {
          const data = JSON.parse(stored);
          this.embeddings = new Map(Object.entries(data));
          console.log(`📚 Loaded ${this.embeddings.size} embeddings from storage`);
        }
      } catch (error) {
        console.error('Error loading embeddings:', error);
      }
    }
  }

  private saveEmbeddings(): void {
    if (typeof window !== 'undefined') {
      try {
        const data = Object.fromEntries(this.embeddings);
        localStorage.setItem('semanticEmbeddings', JSON.stringify(data));
      } catch (error) {
        console.error('Error saving embeddings:', error);
      }
    }
  }

  // Batch operations for better performance
  async batchAddEmbeddings(items: Array<{
    id: string;
    text: string;
    type: EmbeddingData['type'];
    metadata?: Record<string, any>;
  }>): Promise<void> {
    console.log(`🔄 Processing ${items.length} items for embedding...`);
    
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      try {
        await this.addEmbedding(item.id, item.text, item.type, item.metadata || {});
        
        // Add delay to respect OpenAI rate limits
        if (i > 0 && i % 10 === 0) {
          console.log(`📊 Processed ${i}/${items.length} embeddings...`);
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      } catch (error) {
        console.error(`Failed to process item ${item.id}:`, error);
      }
    }
    
    console.log(`✅ Completed embedding ${items.length} items`);
  }

  getEmbeddingCount(): number {
    return this.embeddings.size;
  }

  clearEmbeddings(): void {
    this.embeddings.clear();
    if (typeof window !== 'undefined') {
      localStorage.removeItem('semanticEmbeddings');
    }
  }
}