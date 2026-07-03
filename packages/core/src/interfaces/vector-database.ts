import type { TenantContext } from '../types/context.js';

export interface VectorSearchResult {
  /** The text content of the matched document chunk. */
  text: string;
  /** The similarity score (e.g., cosine similarity distance). */
  score: number;
  /** Metadata associated with the chunk (e.g., source file, page number). */
  metadata?: Record<string, unknown>;
}

export interface VectorDatabaseAdapter {
  /** Name of the vector database adapter (e.g., 'pinecone', 'chroma', 'pgvector') */
  readonly name: string;

  /**
   * Search for documents similar to the given query.
   *
   * @param query - The text query or pre-computed embedding vector.
   * @param limit - Maximum number of results to return.
   * @param context - Optional tenant context to restrict search to a specific tenant's documents.
   * @returns A promise resolving to an array of search results.
   */
  search(query: string, limit?: number, context?: TenantContext): Promise<VectorSearchResult[]>;

  /**
   * Add a new document chunk to the vector database.
   * 
   * @param text - The text content to embed and store.
   * @param metadata - Optional metadata to store alongside the text.
   * @param context - Optional tenant context for data isolation.
   */
  insert(text: string, metadata?: Record<string, unknown>, context?: TenantContext): Promise<void>;

  /**
   * Delete documents matching the given metadata filters or tenant context.
   */
  delete(filter: Record<string, unknown>, context?: TenantContext): Promise<void>;

  /**
   * Initialize or connect to the vector database.
   */
  connect(): Promise<void>;

  /**
   * Disconnect and clean up resources.
   */
  disconnect(): Promise<void>;
}
