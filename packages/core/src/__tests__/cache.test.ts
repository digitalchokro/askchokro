/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-return, @typescript-eslint/unbound-method, @typescript-eslint/explicit-function-return-type, @typescript-eslint/no-unnecessary-type-assertion */
/* eslint-disable @typescript-eslint/unbound-method */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { DatabaseAgent } from '../pipeline/agent.js';
import type { DatabaseAdapter, AIProvider, VectorDatabaseAdapter, VectorSearchResult } from '../interfaces/index.js';
import { InMemoryCacheProvider } from '../providers/memory-cache.js';

describe('DatabaseAgent Caching', () => {
  let mockDb: DatabaseAdapter;
  let mockAi: AIProvider;
  let mockVectorDb: VectorDatabaseAdapter;
  let cache: InMemoryCacheProvider;

  beforeEach(() => {
    mockDb = {
      name: 'mock',
      execute: vi.fn().mockResolvedValue({ rows: [{ id: 1 }] }),
      introspectSchema: vi.fn().mockResolvedValue({ tables: [] }),
      close: vi.fn().mockResolvedValue(undefined),
      dialect: 'sqlite',
    };

    mockAi = {
      name: 'mock-ai',
      generateSQL: vi.fn().mockResolvedValue('SELECT * FROM users;'),
      formatResponse: vi.fn().mockResolvedValue({ answer: 'Mock answer' }),
    };

    mockVectorDb = {
      name: 'mock-vector',
      search: vi.fn().mockResolvedValue([]),
      insert: vi.fn().mockResolvedValue(undefined),
      delete: vi.fn().mockResolvedValue(undefined),
      connect: vi.fn().mockResolvedValue(undefined),
      disconnect: vi.fn().mockResolvedValue(undefined),
    };

    cache = new InMemoryCacheProvider();
  });

  it('Tier 1: uses exact match cache on repeat query', async () => {
    const agent = new DatabaseAgent({
      db: mockDb,
      ai: mockAi,
      cache,
      options: { enableCaching: true, queryResultCacheTtl: 0 }
    });

    // First ask - cache miss
    await agent.ask('How many users?');
    expect(mockAi.generateSQL).toHaveBeenCalledTimes(1);

    // Second ask - exact string match - cache hit
    await agent.ask('How many users?');
    
    // generateSQL should NOT be called again
    expect(mockAi.generateSQL).toHaveBeenCalledTimes(1);
    
    // DB execute SHOULD be called twice
    expect(mockDb.execute).toHaveBeenCalledTimes(2);
  });

  it('Tier 1: respects tenant isolation in exact match cache', async () => {
    const agent = new DatabaseAgent({
      db: mockDb,
      ai: mockAi,
      cache,
      options: { enableCaching: true, queryResultCacheTtl: 0, tenantScoping: { enabled: true, column: 'tenant_id', getValue: (ctx) => ctx.tenantId as string } }
    });

    // First ask for Tenant A
    await agent.ask('How many users?', { tenantId: 'tenantA' });
    expect(mockAi.generateSQL).toHaveBeenCalledTimes(1);

    // Same question for Tenant B - cache MISS because tenantId is part of cache key
    await agent.ask('How many users?', { tenantId: 'tenantB' });
    expect(mockAi.generateSQL).toHaveBeenCalledTimes(2);

    // Same question for Tenant A again - cache HIT
    await agent.ask('How many users?', { tenantId: 'tenantA' });
    expect(mockAi.generateSQL).toHaveBeenCalledTimes(2);
  });

  it('Tier 2: uses semantic cache on similar queries > threshold', async () => {
    // Mock the vector DB to return a semantic match on the second query
    const resultsFirstSearch: VectorSearchResult[] = [];
    const resultsSecondSearch: VectorSearchResult[] = [
      { text: 'How many users total?', score: 0.98, metadata: { type: 'semantic_cache', sql: 'SELECT COUNT(*) FROM users;' } }
    ];

    mockVectorDb.search = vi.fn()
      .mockResolvedValueOnce(resultsFirstSearch)
      .mockResolvedValueOnce(resultsSecondSearch);

    const agent = new DatabaseAgent({
      db: mockDb,
      ai: mockAi,
      vectorDb: mockVectorDb,
      cache,
      options: { enableCaching: true, semanticCacheThreshold: 0.95, queryResultCacheTtl: 0 }
    });

    // First ask - cache miss (vector DB returns empty)
    await agent.ask('How many users total?');
    expect(mockAi.generateSQL).toHaveBeenCalledTimes(1);
    
    // Check that we attempted to store the successful SQL in the vector DB
    expect(mockVectorDb.insert).toHaveBeenCalledTimes(1);
    expect(mockVectorDb.insert).toHaveBeenCalledWith(
      'How many users total?', 
      { type: 'semantic_cache', sql: 'SELECT * FROM users;' }, 
      {}
    );

    // Second ask - different phrasing but high semantic similarity
    await agent.ask('Give me the total number of users');
    
    // Vector search should have been called twice
    expect(mockVectorDb.search).toHaveBeenCalledTimes(2);
    
    // AI generation should NOT be called again due to semantic hit
    expect(mockAi.generateSQL).toHaveBeenCalledTimes(1);
  });

  it('Tier 2: bypasses semantic cache if score < threshold', async () => {
    // Mock vector DB returns a weak match (score 0.80)
    const resultsWeakSearch: VectorSearchResult[] = [
      { text: 'How many active users?', score: 0.80, metadata: { type: 'semantic_cache', sql: 'SELECT COUNT(*) FROM users;' } }
    ];

    mockVectorDb.search = vi.fn().mockResolvedValue(resultsWeakSearch);

    const agent = new DatabaseAgent({
      db: mockDb,
      ai: mockAi,
      vectorDb: mockVectorDb,
      cache,
      options: { enableCaching: true, semanticCacheThreshold: 0.95, queryResultCacheTtl: 0 }
    });

    await agent.ask('Give me the total number of users');
    
    // AI should be called because 0.80 < 0.95
    expect(mockAi.generateSQL).toHaveBeenCalledTimes(1);
  });
});

describe('DatabaseAgent Tier 3 (Query Result Caching)', () => {
  let mockDb: DatabaseAdapter;
  let mockAi: AIProvider;
  let cache: InMemoryCacheProvider;

  beforeEach(() => {
    mockDb = {
      name: 'mock',
      execute: vi.fn().mockResolvedValue({ rows: [{ count: 42 }], rowCount: 1, executionMs: 5 }),
      introspectSchema: vi.fn().mockResolvedValue({ tables: [] }),
      close: vi.fn().mockResolvedValue(undefined),
      dialect: 'sqlite',
    };

    mockAi = {
      name: 'mock-ai',
      generateSQL: vi.fn().mockResolvedValue('SELECT COUNT(*) AS total_users FROM users;'),
      formatResponse: vi.fn().mockResolvedValue({ answer: '42 users' }),
    };

    cache = new InMemoryCacheProvider();
  });

  it('does NOT hit the DB on second identical question (Tier 1 + Tier 3 both hit)', async () => {
    const agent = new DatabaseAgent({
      db: mockDb,
      ai: mockAi,
      cache,
      options: { enableCaching: true, queryResultCacheTtl: 60 },
    });

    // First call: miss on all caches → hits DB
    await agent.ask('How many users are there?');
    expect(mockDb.execute).toHaveBeenCalledTimes(1);

    // Second call: Tier 1 exact match hits for SQL
    // Tier 3 hits for rows — DB should NOT be called again
    await agent.ask('How many users are there?');
    expect(mockDb.execute).toHaveBeenCalledTimes(1);
    expect(mockAi.generateSQL).toHaveBeenCalledTimes(1);
  });

  it('correctly caches an empty result set without re-executing', async () => {
    mockDb.execute = vi.fn().mockResolvedValue({ rows: [], rowCount: 0, executionMs: 3 });

    const agent = new DatabaseAgent({
      db: mockDb,
      ai: mockAi,
      cache,
      options: { enableCaching: true, queryResultCacheTtl: 60 },
    });

    await agent.ask('Show deleted users');
    expect(mockDb.execute).toHaveBeenCalledTimes(1);

    // Second call — Tier 3 has cached empty array
    await agent.ask('Show deleted users');
    // DB execute should NOT have been called a second time
    expect(mockDb.execute).toHaveBeenCalledTimes(1);
  });

  it('disables Tier 3 caching when queryResultCacheTtl is 0', async () => {
    const agent = new DatabaseAgent({
      db: mockDb,
      ai: mockAi,
      cache,
      options: { enableCaching: true, queryResultCacheTtl: 0 },
    });

    await agent.ask('How many users?');
    await agent.ask('How many users?');

    // DB should still be called on second ask because Tier 3 is disabled
    // (Tier 1 SQL cache still bypasses AI, but result cache is off)
    expect(mockAi.generateSQL).toHaveBeenCalledTimes(1); // SQL still cached (Tier 1)
    expect(mockDb.execute).toHaveBeenCalledTimes(2);     // But DB is hit each time
  });

  it('isolates result cache by tenantId', async () => {
    const agent = new DatabaseAgent({
      db: mockDb,
      ai: mockAi,
      cache,
      options: {
        enableCaching: true,
        queryResultCacheTtl: 60,
        tenantScoping: {
          enabled: true,
          column: 'tenant_id',
          getValue: (ctx) => ctx.tenantId as string,
        },
      },
    });

    await agent.ask('How many users?', { tenantId: 'tenantA' });
    expect(mockDb.execute).toHaveBeenCalledTimes(1);

    // Different tenant — result cache MISS (different key)
    await agent.ask('How many users?', { tenantId: 'tenantB' });
    expect(mockDb.execute).toHaveBeenCalledTimes(2);

    // Same tenant A again — result cache HIT
    await agent.ask('How many users?', { tenantId: 'tenantA' });
    expect(mockDb.execute).toHaveBeenCalledTimes(2);
  });
});
