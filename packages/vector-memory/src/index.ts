import type { VectorDatabaseAdapter, VectorSearchResult, TenantContext } from '@digitalchokro/core';

export interface MemoryVectorStoreConfig {
  /** Function to generate an embedding for a given text (e.g., using OpenAI embeddings API). */
  embedFn: (text: string) => Promise<number[]>;
}

interface Document {
  id: string;
  text: string;
  embedding: number[];
  metadata?: Record<string, unknown>;
  tenantId?: string | number;
}

export class MemoryVectorDatabase implements VectorDatabaseAdapter {
  readonly name = 'vector-memory';
  
  private config: MemoryVectorStoreConfig;
  private documents: Document[] = [];
  
  constructor(config: MemoryVectorStoreConfig) {
    this.config = config;
  }
  
  async connect(): Promise<void> {
    // In-memory doesn't need to connect
  }
  
  async disconnect(): Promise<void> {
    this.documents = [];
  }
  
  async insert(text: string, metadata?: Record<string, unknown>, context?: TenantContext): Promise<void> {
    const embedding = await this.config.embedFn(text);
    this.documents.push({
      id: Math.random().toString(36).substring(7),
      text,
      embedding,
      metadata,
      tenantId: context?.tenantId
    });
  }
  
  async delete(filter: Record<string, unknown>, context?: TenantContext): Promise<void> {
    this.documents = this.documents.filter(doc => {
      // Must match tenant if context is provided
      if (context?.tenantId && doc.tenantId !== context.tenantId) return true;
      
      // If no filter is provided, delete nothing (keep all)
      if (Object.keys(filter).length === 0) return true;

      // Match all filter keys
      for (const [key, value] of Object.entries(filter)) {
        if (!doc.metadata || doc.metadata[key] !== value) return true; // keep it if it doesn't match filter
      }
      return false; // delete it if it matches filter
    });
  }
  
  async search(query: string, limit: number = 3, context?: TenantContext): Promise<VectorSearchResult[]> {
    if (this.documents.length === 0) return [];
    
    const queryEmbedding = await this.config.embedFn(query);
    
    const results = this.documents
      .filter(doc => !context?.tenantId || doc.tenantId === context.tenantId)
      .map(doc => ({
        text: doc.text,
        metadata: doc.metadata,
        score: this.cosineSimilarity(queryEmbedding, doc.embedding)
      }))
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);
      
    // Filter out low scores (heuristic threshold of 0.7 for text embeddings)
    return results.filter(r => r.score > 0.7);
  }
  
  private cosineSimilarity(vecA: number[], vecB: number[]): number {
    let dotProduct = 0;
    let normA = 0;
    let normB = 0;
    const len = Math.min(vecA.length, vecB.length);
    for (let i = 0; i < len; i++) {
      const a = vecA[i] as number;
      const b = vecB[i] as number;
      dotProduct += a * b;
      normA += a * a;
      normB += b * b;
    }
    if (normA === 0 || normB === 0) return 0;
    return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
  }
}
