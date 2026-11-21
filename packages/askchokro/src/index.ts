import { DatabaseAgent } from '@digitalchokro/core';
import type { AgentOptions, AgentConfig, AIProvider, DatabaseAdapter, TenantContext, AskResult } from '@digitalchokro/core';

export interface AskChokroConfig {
  /** 
   * Provide a DB connection string, an existing DatabaseAdapter, or leave undefined to auto-detect.
   * Auto-detect checks process.env.DATABASE_URL (Postgres) and falls back to SQLite in-memory.
   */
  db?: string | DatabaseAdapter;
  
  /** 
   * Provide 'openai', 'anthropic', 'gemini', 'ollama', 'groq', an existing AIProvider, or leave undefined to auto-detect.
   * Auto-detect checks process.env.OPENAI_API_KEY (OpenAI), then ANTHROPIC_API_KEY, then GEMINI_API_KEY, and falls back to Ollama.
   */
  provider?: 'openai' | 'anthropic' | 'gemini' | 'ollama' | 'groq' | AIProvider;
  
  /** Model name for the chosen provider. Defaults to provider-specific recommendations. */
  model?: string;

  /** Vector database for unstructured RAG queries */
  vectorDb?: import('@digitalchokro/core').VectorDatabaseAdapter;

  /** Agent configuration options. */
  options?: AgentOptions;

  /** Advanced overrides for hooks, custom validators, etc. */
  overrides?: Omit<AgentConfig, 'db' | 'ai' | 'options' | 'vectorDb'>;
}

export class AskChokro {
  private agentPromise: Promise<DatabaseAgent>;
  private dbAdapter: DatabaseAdapter | null = null;

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
      } else if (config.db.startsWith('mysql://') || config.db.startsWith('mariadb://')) {
        const { MysqlAdapter } = await import('@digitalchokro/db-mysql');
        db = new MysqlAdapter({ connectionString: config.db });
      } else if (config.db.startsWith('duckdb://') || config.db.endsWith('.duckdb')) {
        const { DuckDBAdapter } = await import('@digitalchokro/db-duckdb');
        const duckPath = config.db.replace(/^duckdb:\/\//, '');
        db = new DuckDBAdapter({ path: duckPath });
      } else if (config.db.startsWith('clickhouse://')) {
        const { ClickHouseAdapter } = await import('@digitalchokro/db-clickhouse');
        const clickUrl = config.db.replace(/^clickhouse:\/\//, 'http://');
        db = new ClickHouseAdapter({ url: clickUrl });
      } else if (config.db.endsWith('.sqlite') || config.db.endsWith('.db') || config.db === ':memory:') {
        const { SQLiteAdapter } = await import('@digitalchokro/db-sqlite');
        db = new SQLiteAdapter({ path: config.db });
      } else {
        throw new Error(`Unsupported database connection string: ${config.db}. Try postgres://, mysql://, duckdb://, clickhouse:// or :memory:`);
      }
    } else if (config.db) {
      db = config.db;
    } else if (process.env.DATABASE_URL) {
      if (process.env.DATABASE_URL.startsWith('mysql://') || process.env.DATABASE_URL.startsWith('mariadb://')) {
        const { MysqlAdapter } = await import('@digitalchokro/db-mysql');
        db = new MysqlAdapter({ connectionString: process.env.DATABASE_URL });
      } else if (process.env.DATABASE_URL.startsWith('duckdb://') || process.env.DATABASE_URL.endsWith('.duckdb')) {
        const { DuckDBAdapter } = await import('@digitalchokro/db-duckdb');
        const duckPath = process.env.DATABASE_URL.replace(/^duckdb:\/\//, '');
        db = new DuckDBAdapter({ path: duckPath });
      } else if (process.env.DATABASE_URL.startsWith('clickhouse://')) {
        const { ClickHouseAdapter } = await import('@digitalchokro/db-clickhouse');
        const clickUrl = process.env.DATABASE_URL.replace(/^clickhouse:\/\//, 'http://');
        db = new ClickHouseAdapter({ url: clickUrl });
      } else if (process.env.DATABASE_URL.startsWith('sqlite://') || process.env.DATABASE_URL.endsWith('.sqlite') || process.env.DATABASE_URL.endsWith('.db') || process.env.DATABASE_URL === ':memory:') {
        const { SQLiteAdapter } = await import('@digitalchokro/db-sqlite');
        const sqlitePath = process.env.DATABASE_URL.replace(/^sqlite:\/\//, '');
        db = new SQLiteAdapter({ path: sqlitePath });
      } else {
        const { PostgresAdapter } = await import('@digitalchokro/db-postgres');
        db = new PostgresAdapter({ connectionString: process.env.DATABASE_URL });
      }
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
          model: config.model || process.env.ASKCHOKRO_MODEL || process.env.OLLAMA_MODEL || 'qwen2.5:0.5b',
          baseUrl: process.env.OLLAMA_BASE_URL || process.env.OLLAMA_URL || 'http://localhost:11434'
        });
      } else if (config.provider === 'groq') {
        const { GroqProvider } = await import('@digitalchokro/provider-groq');
        ai = new GroqProvider({ 
          apiKey: process.env.GROQ_API_KEY, 
          model: config.model || process.env.ASKCHOKRO_MODEL || 'llama3-70b-8192'
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
        model: config.model || process.env.ASKCHOKRO_MODEL || process.env.OLLAMA_MODEL || 'qwen2.5:0.5b',
        baseUrl: process.env.OLLAMA_BASE_URL || process.env.OLLAMA_URL || 'http://localhost:11434'
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
        model: config.model || process.env.ASKCHOKRO_MODEL || process.env.OLLAMA_MODEL || 'qwen2.5:0.5b',
        baseUrl: process.env.OLLAMA_BASE_URL || process.env.OLLAMA_URL || 'http://localhost:11434'
      });
    }

    // Store adapter reference for health checks
    this.dbAdapter = db;

    return new DatabaseAgent({
      db,
      ai,
      vectorDb: config.vectorDb,
      options: config.options,
      ...config.overrides
    });
  }

  async ask(question: string, context?: TenantContext): Promise<AskResult> {
    const agent = await this.agentPromise;
    return agent.ask(question, context);
  }

  /**
   * Ask a question and stream SQL, rows, and the response back via Server-Sent Events (SSE).
   */
  async *stream(question: string, context?: TenantContext): AsyncIterable<import('@digitalchokro/core').StreamChunk> {
    const agent = await this.agentPromise;
    yield* agent.stream(question, context);
  }

  annotate(annotations: Record<string, string>): void {
    this.agentPromise.then(agent => agent.annotate(annotations)).catch(console.error);
  }

  /**
   * Deep health check. Verifies agent initialized and the database connection
   * is alive by executing a lightweight query.
   * @returns true if the service is healthy
   */
  async ping(): Promise<boolean> {
    try {
      await this.agentPromise; // ensure initialization completed
      if (!this.dbAdapter) return false;
      await this.dbAdapter.execute('SELECT 1');
      return true;
    } catch {
      return false;
    }
  }

  async dispose(): Promise<void> {
    const agent = await this.agentPromise;
    return agent.dispose();
  }
}

// Re-export everything from core for convenience
export * from '@digitalchokro/core';
