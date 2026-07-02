import { DatabaseAgent } from '@digitalchokro/core';
import type { AgentOptions, AgentConfig, AIProvider, DatabaseAdapter } from '@digitalchokro/core';

export interface AskChokroConfig {
  /** 
   * Provide a DB connection string, an existing DatabaseAdapter, or leave undefined to auto-detect.
   * Auto-detect checks process.env.DATABASE_URL (Postgres) and falls back to SQLite in-memory.
   */
  db?: string | DatabaseAdapter;
  
  /** 
   * Provide 'openai', 'anthropic', 'gemini', 'ollama', an existing AIProvider, or leave undefined to auto-detect.
   * Auto-detect checks process.env.OPENAI_API_KEY (OpenAI), then ANTHROPIC_API_KEY, then GEMINI_API_KEY, and falls back to Ollama.
   */
  provider?: 'openai' | 'anthropic' | 'gemini' | 'ollama' | AIProvider;
  
  /** Model name for the chosen provider. Defaults to provider-specific recommendations. */
  model?: string;

  /** Agent configuration options. */
  options?: AgentOptions;

  /** Advanced overrides for hooks, custom validators, etc. */
  overrides?: Omit<AgentConfig, 'db' | 'ai' | 'options'>;
}

export class AskChokro {
  private agentPromise: Promise<DatabaseAgent>;

  constructor(config: AskChokroConfig = {}) {
    this.agentPromise = this.init(config);
  }

  private async init(config: AskChokroConfig): Promise<DatabaseAgent> {
    let db: DatabaseAdapter;
    let ai: AIProvider;

    // 1. Resolve Database
    if (typeof config.db === 'string') {
      if (config.db.startsWith('postgres://') || config.db.startsWith('postgresql://')) {
        const { PostgresAdapter } = await import('@digitalchokro/db-postgres');
        db = new PostgresAdapter({ connectionString: config.db });
      } else if (config.db.endsWith('.sqlite') || config.db.endsWith('.db') || config.db === ':memory:') {
        const { SQLiteAdapter } = await import('@digitalchokro/db-sqlite');
        db = new SQLiteAdapter({ path: config.db });
      } else {
        throw new Error(`Unsupported database connection string: ${config.db}. Try postgres://... or :memory:`);
      }
    } else if (config.db) {
      db = config.db;
    } else if (process.env.DATABASE_URL) {
      const { PostgresAdapter } = await import('@digitalchokro/db-postgres');
      db = new PostgresAdapter({ connectionString: process.env.DATABASE_URL });
    } else {
      console.warn('⚠️ No database configured and no DATABASE_URL found. Falling back to SQLite in-memory.');
      const { SQLiteAdapter } = await import('@digitalchokro/db-sqlite');
      db = new SQLiteAdapter({ path: ':memory:' });
    }

    // 2. Resolve AI Provider
    if (typeof config.provider === 'string') {
      if (config.provider === 'openai') {
        const { OpenAIProvider } = await import('@digitalchokro/provider-openai');
        ai = new OpenAIProvider({ 
          apiKey: process.env.OPENAI_API_KEY, 
          model: config.model 
        });
      } else if (config.provider === 'anthropic') {
        const { AnthropicProvider } = await import('@digitalchokro/provider-anthropic');
        ai = new AnthropicProvider({ 
          apiKey: process.env.ANTHROPIC_API_KEY, 
          model: config.model || process.env.ASKCHOKRO_MODEL 
        });
      } else if (config.provider === 'gemini') {
        const { GeminiProvider } = await import('@digitalchokro/provider-gemini');
        ai = new GeminiProvider({
          apiKey: process.env.GEMINI_API_KEY,
          model: config.model || process.env.ASKCHOKRO_MODEL
        });
      } else if (config.provider === 'ollama') {
        const { OllamaProvider } = await import('@digitalchokro/provider-ollama');
        ai = new OllamaProvider({ 
          model: config.model || process.env.ASKCHOKRO_MODEL || process.env.OLLAMA_MODEL || 'qwen2.5-coder'
        });
      } else {
        throw new Error(`Unsupported string provider: ${String(config.provider)}`);
      }
    } else if (config.provider) {
      ai = config.provider;
    } else if (process.env.ASKCHOKRO_PROVIDER === 'gemini') {
      const { GeminiProvider } = await import('@digitalchokro/provider-gemini');
      ai = new GeminiProvider({ 
        apiKey: process.env.GEMINI_API_KEY, 
        model: config.model || process.env.ASKCHOKRO_MODEL 
      });
    } else if (process.env.ASKCHOKRO_PROVIDER === 'anthropic') {
      const { AnthropicProvider } = await import('@digitalchokro/provider-anthropic');
      ai = new AnthropicProvider({ 
        apiKey: process.env.ANTHROPIC_API_KEY, 
        model: config.model || process.env.ASKCHOKRO_MODEL 
      });
    } else if (process.env.ASKCHOKRO_PROVIDER === 'ollama') {
      const { OllamaProvider } = await import('@digitalchokro/provider-ollama');
      ai = new OllamaProvider({ 
        model: config.model || process.env.ASKCHOKRO_MODEL || process.env.OLLAMA_MODEL || 'qwen2.5-coder'
      });
    } else if (process.env.ASKCHOKRO_PROVIDER === 'openai') {
      const { OpenAIProvider } = await import('@digitalchokro/provider-openai');
      ai = new OpenAIProvider({ 
        apiKey: process.env.OPENAI_API_KEY, 
        model: config.model || process.env.ASKCHOKRO_MODEL 
      });
    } else if (process.env.OPENAI_API_KEY) {
      const { OpenAIProvider } = await import('@digitalchokro/provider-openai');
      ai = new OpenAIProvider({ 
        apiKey: process.env.OPENAI_API_KEY, 
        model: config.model || process.env.ASKCHOKRO_MODEL 
      });
    } else if (process.env.ANTHROPIC_API_KEY) {
      const { AnthropicProvider } = await import('@digitalchokro/provider-anthropic');
      ai = new AnthropicProvider({ 
        apiKey: process.env.ANTHROPIC_API_KEY, 
        model: config.model || process.env.ASKCHOKRO_MODEL 
      });
    } else if (process.env.GEMINI_API_KEY) {
      const { GeminiProvider } = await import('@digitalchokro/provider-gemini');
      ai = new GeminiProvider({ 
        apiKey: process.env.GEMINI_API_KEY, 
        model: config.model || process.env.ASKCHOKRO_MODEL 
      });
    } else {
      console.warn('⚠️ No provider configured and no OPENAI_API_KEY, ANTHROPIC_API_KEY, or GEMINI_API_KEY found. Falling back to Ollama.');
      const { OllamaProvider } = await import('@digitalchokro/provider-ollama');
      ai = new OllamaProvider({ 
        model: config.model || process.env.ASKCHOKRO_MODEL || process.env.OLLAMA_MODEL || 'qwen2.5-coder' 
      });
    }

    return new DatabaseAgent({
      db,
      ai,
      options: config.options,
      ...config.overrides
    });
  }

  async ask(question: string, context?: any) {
    const agent = await this.agentPromise;
    return agent.ask(question, context);
  }

  annotate(annotations: Record<string, string>): void {
    this.agentPromise.then(agent => agent.annotate(annotations)).catch(console.error);
  }

  async dispose(): Promise<void> {
    const agent = await this.agentPromise;
    return agent.dispose();
  }
}

// Re-export everything from core for convenience
export * from '@digitalchokro/core';
