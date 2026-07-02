import { DatabaseAgent } from '@digitalchokro/core';
import type { AgentOptions, AgentConfig, AIProvider, DatabaseAdapter } from '@digitalchokro/core';
import { PostgresAdapter } from '@digitalchokro/db-postgres';
import { SQLiteAdapter } from '@digitalchokro/db-sqlite';
import { OpenAIProvider } from '@digitalchokro/provider-openai';
import { OllamaProvider } from '@digitalchokro/provider-ollama';

export interface AskChokroConfig {
  /** 
   * Provide a DB connection string, an existing DatabaseAdapter, or leave undefined to auto-detect.
   * Auto-detect checks process.env.DATABASE_URL (Postgres) and falls back to SQLite in-memory.
   */
  db?: string | DatabaseAdapter;
  
  /** 
   * Provide 'openai', 'ollama', an existing AIProvider, or leave undefined to auto-detect.
   * Auto-detect checks process.env.OPENAI_API_KEY (OpenAI) and falls back to Ollama.
   */
  provider?: 'openai' | 'ollama' | AIProvider;
  
  /** Model name for the chosen provider. Defaults to provider-specific recommendations. */
  model?: string;

  /** Agent configuration options. */
  options?: AgentOptions;

  /** Advanced overrides for hooks, custom validators, etc. */
  overrides?: Omit<AgentConfig, 'db' | 'ai' | 'options'>;
}

export class AskChokro extends DatabaseAgent {
  constructor(config: AskChokroConfig = {}) {
    let db: DatabaseAdapter;
    let ai: AIProvider;

    // 1. Resolve Database
    if (typeof config.db === 'string') {
      if (config.db.startsWith('postgres://') || config.db.startsWith('postgresql://')) {
        db = new PostgresAdapter({ connectionString: config.db });
      } else if (config.db.endsWith('.sqlite') || config.db.endsWith('.db') || config.db === ':memory:') {
        db = new SQLiteAdapter({ path: config.db });
      } else {
        throw new Error(`Unsupported database connection string: ${config.db}. Try postgres://... or :memory:`);
      }
    } else if (config.db) {
      db = config.db;
    } else if (process.env.DATABASE_URL) {
      db = new PostgresAdapter({ connectionString: process.env.DATABASE_URL });
    } else {
      console.warn('⚠️ No database configured and no DATABASE_URL found. Falling back to SQLite in-memory.');
      db = new SQLiteAdapter({ path: ':memory:' });
    }

    // 2. Resolve AI Provider
    if (typeof config.provider === 'string') {
      if (config.provider === 'openai') {
        ai = new OpenAIProvider({ 
          apiKey: process.env.OPENAI_API_KEY, 
          model: config.model 
        });
      } else if (config.provider === 'ollama') {
        ai = new OllamaProvider({ 
          model: config.model || process.env.OLLAMA_MODEL || 'qwen2.5-coder'
        });
      } else {
        throw new Error(`Unsupported string provider: ${String(config.provider)}`);
      }
    } else if (config.provider) {
      ai = config.provider;
    } else if (process.env.ASKCHOKRO_PROVIDER === 'ollama') {
      ai = new OllamaProvider({ 
        model: config.model || process.env.OLLAMA_MODEL || 'qwen2.5-coder'
      });
    } else if (process.env.ASKCHOKRO_PROVIDER === 'openai') {
      ai = new OpenAIProvider({ 
        apiKey: process.env.OPENAI_API_KEY, 
        model: config.model 
      });
    } else if (process.env.OPENAI_API_KEY) {
      ai = new OpenAIProvider({ 
        apiKey: process.env.OPENAI_API_KEY, 
        model: config.model 
      });
    } else {
      console.warn('⚠️ No provider configured and no OPENAI_API_KEY found. Falling back to Ollama.');
      ai = new OllamaProvider({ 
        model: config.model || process.env.OLLAMA_MODEL || 'qwen2.5-coder' 
      });
    }

    // Initialize the underlying DatabaseAgent
    super({
      db,
      ai,
      options: config.options,
      ...config.overrides
    });
  }
}

// Re-export everything from core for convenience
export * from '@digitalchokro/core';
