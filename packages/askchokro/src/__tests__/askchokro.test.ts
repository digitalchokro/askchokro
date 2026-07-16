/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-return, @typescript-eslint/unbound-method, @typescript-eslint/explicit-function-return-type, @typescript-eslint/no-unnecessary-type-assertion */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { AskChokro } from '../index.js';
import { AskChokroError } from '@digitalchokro/core';

// Mock all adapters and providers
vi.mock('@digitalchokro/db-postgres', () => ({
  PostgresAdapter: vi.fn(function PostgresAdapter() { return { name: 'postgres' }; })
}));

vi.mock('@digitalchokro/db-mysql', () => ({
  MysqlAdapter: vi.fn(function MysqlAdapter() { return { name: 'mysql' }; })
}));

vi.mock('@digitalchokro/db-sqlite', () => ({
  SQLiteAdapter: vi.fn(function SQLiteAdapter() { return { name: 'sqlite' }; })
}));

vi.mock('@digitalchokro/provider-openai', () => ({
  OpenAIProvider: vi.fn(function OpenAIProvider() { return { name: 'openai' }; })
}));

vi.mock('@digitalchokro/provider-anthropic', () => ({
  AnthropicProvider: vi.fn(function AnthropicProvider() { return { name: 'anthropic' }; })
}));

vi.mock('@digitalchokro/provider-gemini', () => ({
  GeminiProvider: vi.fn(function GeminiProvider() { return { name: 'gemini' }; })
}));

vi.mock('@digitalchokro/provider-ollama', () => ({
  OllamaProvider: vi.fn(function OllamaProvider() { return { name: 'ollama' }; })
}));

// Mock DatabaseAgent
vi.mock('@digitalchokro/core', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@digitalchokro/core')>();
  const mockAsk = vi.fn();
  const mockAnnotate = vi.fn();
  const mockDispose = vi.fn();
  
  return {
    ...actual,
    DatabaseAgent: vi.fn(function MockAgent(config) {
      return {
        ask: mockAsk,
        annotate: mockAnnotate,
        dispose: mockDispose,
        config // Expose config for test assertions
      };
    })
  };
});

describe('@digitalchokro/askchokro', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.clearAllMocks();
    process.env = { ...originalEnv };
    // Clear out any env vars that might interfere
    delete process.env.DATABASE_URL;
    delete process.env.OPENAI_API_KEY;
    delete process.env.ANTHROPIC_API_KEY;
    delete process.env.GEMINI_API_KEY;
    delete process.env.ASKCHOKRO_PROVIDER;
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe('AskChokro Class Initialization', () => {
    it('initializes with explicit provider and database adapter objects', async () => {
      const mockDb = { dialect: 'sqlite', execute: vi.fn() } as any;
      const mockAi = { name: 'mock-ai', generateSQL: vi.fn() } as any;
      
      const chokro = new AskChokro({ db: mockDb, provider: mockAi });
      const agent = await (chokro as any).agentPromise;
      
      expect(agent.config.db).toBe(mockDb);
      expect(agent.config.ai).toBe(mockAi);
    });

    it('auto-discovers Postgres via postgres:// connection string', async () => {
      const chokro = new AskChokro({ db: 'postgres://user:pass@localhost/db', provider: 'openai' });
      const agent = await (chokro as any).agentPromise;
      expect(agent.config.db.name).toBe('postgres');
    });

    it('auto-discovers MySQL via mysql:// connection string', async () => {
      const chokro = new AskChokro({ db: 'mysql://user:pass@localhost/db', provider: 'openai' });
      const agent = await (chokro as any).agentPromise;
      expect(agent.config.db.name).toBe('mysql');
    });

    it('auto-discovers SQLite via :memory:', async () => {
      const chokro = new AskChokro({ db: ':memory:', provider: 'openai' });
      const agent = await (chokro as any).agentPromise;
      expect(agent.config.db.name).toBe('sqlite');
    });

    it('falls back to SQLite in-memory if no DB provided', async () => {
      const chokro = new AskChokro({ provider: 'openai' });
      const agent = await (chokro as any).agentPromise;
      expect(agent.config.db.name).toBe('sqlite');
    });

    it('auto-discovers Anthropic via string', async () => {
      const chokro = new AskChokro({ provider: 'anthropic' });
      const agent = await (chokro as any).agentPromise;
      expect(agent.config.ai.name).toBe('anthropic');
    });

    it('falls back to Ollama if no provider or keys are present', async () => {
      const chokro = new AskChokro({});
      const agent = await (chokro as any).agentPromise;
      expect(agent.config.ai.name).toBe('ollama');
    });

    it('auto-discovers provider via OPENAI_API_KEY env var', async () => {
      process.env.OPENAI_API_KEY = 'test-key';
      const chokro = new AskChokro({});
      const agent = await (chokro as any).agentPromise;
      expect(agent.config.ai.name).toBe('openai');
    });
  });

  describe('Orchestration / Delegation', () => {
    it('delegates ask() to DatabaseAgent', async () => {
      const chokro = new AskChokro({ provider: 'ollama' });
      const agent = await (chokro as any).agentPromise;
      
      agent.ask.mockResolvedValue({ answer: 'Delegated result' });
      
      const result = await chokro.ask('test question', { tenantId: '1' });
      expect(agent.ask).toHaveBeenCalledWith('test question', { tenantId: '1' });
      expect(result.answer).toBe('Delegated result');
    });

    it('delegates annotate() to DatabaseAgent', async () => {
      const chokro = new AskChokro({ provider: 'ollama' });
      const agent = await (chokro as any).agentPromise;
      
      chokro.annotate({ test: 'val' });
      
      // Since it's fire-and-forget in the implementation (then/catch)
      // we await a small tick
      await new Promise(resolve => setTimeout(resolve, 0));
      expect(agent.annotate).toHaveBeenCalledWith({ test: 'val' });
    });

    it('delegates dispose() to DatabaseAgent', async () => {
      const chokro = new AskChokro({ provider: 'ollama' });
      const agent = await (chokro as any).agentPromise;
      
      await chokro.dispose();
      expect(agent.dispose).toHaveBeenCalled();
    });
  });

  describe('Integration / Behavior Forwarding', () => {
    it('bubbles up DatabaseAgent errors', async () => {
      const chokro = new AskChokro({ provider: 'ollama' });
      const agent = await (chokro as any).agentPromise;
      
      const expectedError = new AskChokroError('SQL_EXECUTION_FAILED', 'Failed', 'Check your SQL query.');
      agent.ask.mockRejectedValue(expectedError);
      
      await expect(chokro.ask('test')).rejects.toThrow('Failed');
      await expect(chokro.ask('test')).rejects.toBeInstanceOf(AskChokroError);
    });
  });
});
