import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { AskChokro } from './index.js';
import { SQLiteAdapter } from '@digitalchokro/db-sqlite';
import { OllamaProvider } from '@digitalchokro/provider-ollama';
import type { AgentConfig } from '@digitalchokro/core';

describe('AskChokro Convenience Wrapper', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.resetModules();
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('uses explicitly provided DB and AI instances', async () => {
    const db = new SQLiteAdapter({ path: ':memory:' });
    const ai = new OllamaProvider({ model: 'test' });
    const agent = new AskChokro({ db, provider: ai });
    
    const internalAgent = await (agent as unknown as { agentPromise: Promise<{ config: AgentConfig }> }).agentPromise;
    expect(internalAgent.config.db).toBe(db);
    expect(internalAgent.config.ai).toBe(ai);
  });

  it('auto-detects PostgresAdapter when DATABASE_URL is set', async () => {
    process.env.DATABASE_URL = 'postgres://user:pass@localhost:5432/db';
    const agent = new AskChokro();
    
    const internalAgent = await (agent as unknown as { agentPromise: Promise<{ config: AgentConfig }> }).agentPromise;
    expect(internalAgent.config.db.dialect).toBe('postgres');
  });

  it('auto-detects SQLiteAdapter when no DB config is present', async () => {
    delete process.env.DATABASE_URL;
    const agent = new AskChokro();
    
    const internalAgent = await (agent as unknown as { agentPromise: Promise<{ config: AgentConfig }> }).agentPromise;
    expect(internalAgent.config.db.dialect).toBe('sqlite');
  });

  it('auto-detects OpenAIProvider when OPENAI_API_KEY is set', async () => {
    process.env.OPENAI_API_KEY = 'sk-test';
    const agent = new AskChokro();
    
    const internalAgent = await (agent as unknown as { agentPromise: Promise<{ config: AgentConfig }> }).agentPromise;
    expect(internalAgent.config.ai.name).toBe('openai');
  });

  it('auto-detects OllamaProvider when no AI config is present', async () => {
    delete process.env.OPENAI_API_KEY;
    const agent = new AskChokro();
    
    const internalAgent = await (agent as unknown as { agentPromise: Promise<{ config: AgentConfig }> }).agentPromise;
    expect(internalAgent.config.ai.name).toBe('ollama');
  });

  it('forces OllamaProvider when ASKCHOKRO_PROVIDER=ollama even if OPENAI_API_KEY is set', async () => {
    process.env.OPENAI_API_KEY = 'sk-test';
    process.env.ASKCHOKRO_PROVIDER = 'ollama';
    const agent = new AskChokro();
    
    const internalAgent = await (agent as unknown as { agentPromise: Promise<{ config: AgentConfig }> }).agentPromise;
    expect(internalAgent.config.ai.name).toBe('ollama');
  });
});
