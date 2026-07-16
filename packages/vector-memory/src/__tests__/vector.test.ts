/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-return, @typescript-eslint/unbound-method, @typescript-eslint/explicit-function-return-type, @typescript-eslint/no-unnecessary-type-assertion */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { MemoryVectorDatabase } from '../index.js';

describe('@digitalchokro/vector-memory', () => {
  let db: MemoryVectorDatabase;

  // Simple mock embedding function that returns predictable vectors
  // e.g., 'hello' -> [1, 0], 'world' -> [0, 1], 'hello world' -> [0.707, 0.707]
  const mockEmbedFn = vi.fn(async (text: string) => {
    if (text === 'hello') return [1, 0, 0];
    if (text === 'world') return [0, 1, 0];
    if (text === 'foo') return [0, 0, 1];
    if (text.includes('hello') && text.includes('world')) return [0.707, 0.707, 0];
    return [0.5, 0.5, 0.5]; // generic
  });

  beforeEach(() => {
    db = new MemoryVectorDatabase({ embedFn: mockEmbedFn });
  });

  describe('Connection Lifecycle', () => {
    it('connects and disconnects cleanly', async () => {
      await expect(db.connect()).resolves.toBeUndefined();
      
      // Insert something, then disconnect should clear it
      await db.insert('hello');
      await db.disconnect();
      
      const results = await db.search('hello');
      expect(results).toHaveLength(0);
    });
  });

  describe('Basic Insertion and Search', () => {
    it('inserts text and searches by cosine similarity', async () => {
      await db.insert('hello', { source: 'greeting' });
      await db.insert('world', { source: 'noun' });
      await db.insert('foo', { source: 'misc' });

      // Search for 'hello' ([1, 0, 0])
      const results = await db.search('hello');
      
      expect(results).toHaveLength(1);
      expect(results[0]!.text).toBe('hello');
      expect(results[0]!.metadata).toEqual({ source: 'greeting' });
      expect(results[0]!.score).toBeCloseTo(1.0); // Exact match cosine similarity = 1
    });

    it('returns empty array if database is empty', async () => {
      const results = await db.search('hello');
      expect(results).toEqual([]);
    });

    it('filters out results below the 0.7 similarity threshold', async () => {
      await db.insert('world'); // [0, 1, 0]
      
      // Search for 'hello' ([1, 0, 0])
      // Cosine similarity of [1,0,0] and [0,1,0] is 0
      const results = await db.search('hello');
      expect(results).toHaveLength(0);
    });
    
    it('sorts results by similarity score', async () => {
      // Mock embed logic mapping for this specific test
      const tempEmbedFn = async (text: string): Promise<number[]> => {
        if (text === 'target') return [1, 0];
        if (text === 'exact') return [1, 0];
        if (text === 'close') return [0.9, 0.1];
        if (text === 'far') return [0.1, 0.9];
        return [0, 1];
      };
      const tempDb = new MemoryVectorDatabase({ embedFn: tempEmbedFn });
      
      await tempDb.insert('far');
      await tempDb.insert('close');
      await tempDb.insert('exact');
      
      const results = await tempDb.search('target', 3);
      expect(results).toHaveLength(2); // 'far' scores < 0.7
      expect(results[0]!.text).toBe('exact');
      expect(results[1]!.text).toBe('close');
    });
    
    it('respects the search limit parameter', async () => {
      // Mock embed logic mapping for this specific test
      const tempEmbedFn = async (text: string): Promise<number[]> => {
        if (text === 'target') return [1, 0];
        if (text.startsWith('match')) return [1, 0];
        return [0, 1];
      };
      const tempDb = new MemoryVectorDatabase({ embedFn: tempEmbedFn });
      
      await tempDb.insert('match1');
      await tempDb.insert('match2');
      await tempDb.insert('match3');
      await tempDb.insert('match4');
      
      const results = await tempDb.search('target', 2);
      expect(results).toHaveLength(2);
    });
  });

  describe('Deletion', () => {
    it('deletes documents matching metadata filter', async () => {
      await db.insert('hello', { tag: 'A' });
      await db.insert('hello', { tag: 'B' });
      
      await db.delete({ tag: 'A' });
      
      const results = await db.search('hello');
      expect(results).toHaveLength(1);
      expect(results[0]!.metadata?.tag).toBe('B');
    });

    it('does nothing if no filter is provided', async () => {
      await db.insert('hello', { tag: 'A' });
      await db.delete({});
      
      const results = await db.search('hello');
      expect(results).toHaveLength(1);
    });
  });

  describe('Tenant Scoping', () => {
    it('isolates search results by tenant', async () => {
      await db.insert('hello', { tag: 'A' }, { tenantId: 'tenant1' });
      await db.insert('hello', { tag: 'B' }, { tenantId: 'tenant2' });

      const resultsT1 = await db.search('hello', 5, { tenantId: 'tenant1' });
      expect(resultsT1).toHaveLength(1);
      expect(resultsT1[0]!.metadata?.tag).toBe('A');

      const resultsT2 = await db.search('hello', 5, { tenantId: 'tenant2' });
      expect(resultsT2).toHaveLength(1);
      expect(resultsT2[0]!.metadata?.tag).toBe('B');
    });

    it('isolates deletions by tenant', async () => {
      await db.insert('hello', { tag: 'A' }, { tenantId: 'tenant1' });
      await db.insert('hello', { tag: 'A' }, { tenantId: 'tenant2' });

      // Delete tag A for tenant1
      await db.delete({ tag: 'A' }, { tenantId: 'tenant1' });

      // tenant1 should be empty
      const resultsT1 = await db.search('hello', 5, { tenantId: 'tenant1' });
      expect(resultsT1).toHaveLength(0);

      // tenant2 should remain intact
      const resultsT2 = await db.search('hello', 5, { tenantId: 'tenant2' });
      expect(resultsT2).toHaveLength(1);
    });
    
    it('finds global documents if no tenant is provided', async () => {
      // Document without tenant ID
      await db.insert('hello', { tag: 'global' });
      
      const results = await db.search('hello');
      expect(results).toHaveLength(1);
    });
  });
});
