import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { AskChokro } from './index.js';
import { PostgresAdapter } from '@askchokro/db-postgres';
import { SQLiteAdapter } from '@askchokro/db-sqlite';
import { OpenAIProvider } from '@askchokro/provider-openai';
import { OllamaProvider } from '@askchokro/provider-ollama';

describe('AskChokro Convenience Wrapper', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.resetModules();
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('uses explicitly provided DB and AI instances', () => {
    const db = new SQLiteAdapter({ path: ':memory:' });
    const ai = new OllamaProvider({ model: 'test' });
    const agent = new AskChokro({ db, provider: ai });
    expect((agent as any).config.db).toBe(db);
    expect((agent as any).config.ai).toBe(ai);
  });

  it('auto-detects PostgresAdapter when DATABASE_URL is set', () => {
    process.env.DATABASE_URL = 'postgres://user:pass@localhost:5432/db';
    const agent = new AskChokro();
    expect((agent as any).config.db).toBeInstanceOf(PostgresAdapter);
  });

  it('auto-detects SQLiteAdapter when no DB config is present', () => {
    delete process.env.DATABASE_URL;
    const agent = new AskChokro();
    expect((agent as any).config.db).toBeInstanceOf(SQLiteAdapter);
  });

  it('auto-detects OpenAIProvider when OPENAI_API_KEY is set', () => {
    process.env.OPENAI_API_KEY = 'sk-test';
    const agent = new AskChokro();
    expect((agent as any).config.ai).toBeInstanceOf(OpenAIProvider);
  });

  it('auto-detects OllamaProvider when no AI config is present', () => {
    delete process.env.OPENAI_API_KEY;
    const agent = new AskChokro();
    expect((agent as any).config.ai).toBeInstanceOf(OllamaProvider);
  });
});
