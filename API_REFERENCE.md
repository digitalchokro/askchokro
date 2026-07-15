# API Reference — AskChokro

Complete API reference for all AskChokro packages. Auto-generated from source — always up to date.

---

## Table of Contents
1. [Core Package (`@digitalchokro/core`)](#core-package)
2. [Main Package (`@digitalchokro/askchokro`)](#main-package)
3. [Database Adapters](#database-adapters)
4. [AI Providers](#ai-providers)
5. [Web Framework Adapters](#web-framework-adapters)
6. [CLI Tool](#cli-tool)
7. [WordPress Plugin](#wordpress-plugin)
8. [Vector Memory](#vector-memory)
9. [Error Handling](#error-handling)
10. [Environment Variables](#environment-variables)

---

## Core Package

`@digitalchokro/core` — The foundational engine.

### `DatabaseAgent`

The main query execution engine. All higher-level wrappers use this internally.

```typescript
import { DatabaseAgent } from '@digitalchokro/core';

const agent = new DatabaseAgent(config, hooks?);
const result = await agent.ask(question, context?);
```

### `AgentConfig`

```typescript
interface AgentConfig {
  /** Database adapter to execute queries against. */
  db: DatabaseAdapter;
  /** AI provider to generate SQL. */
  ai: AIProvider;
  /** Optional cache provider (enables Tier 1, 2, 3 caching). */
  cache?: CacheProvider;
  /** Optional vector store for semantic caching (Tier 2). */
  vectorStore?: VectorDatabaseAdapter;
  /** Optional logger (e.g. Winston, Pino). */
  logger?: Logger;
  /** Optional telemetry provider. */
  telemetry?: TelemetryProvider;
}
```

### `AgentOptions`

Passed inside `AskChokro({ options: { ... } })` or `DatabaseAgent(config)`.

```typescript
interface AgentOptions {
  /** Enforce read-only queries. Default: true. MUST NOT be set to false. */
  readOnly?: boolean;
  /** Maximum rows returned per query. Default: 200. */
  maxRows?: number;
  /** Maximum AI retry attempts on SQL validation failure. Default: 2. */
  maxRetries?: number;
  /** Database query timeout in milliseconds. Default: 10_000. */
  queryTimeoutMs?: number;
  /** Only these tables can be queried. AI never sees others. */
  allowedTables?: string[];
  /** These tables are completely hidden from the AI. */
  blockedTables?: string[];
  /** These columns are stripped from schema context AND query results. */
  blockedColumns?: string[];
  /** Enable full audit logging of questions, SQL, results, and tokens. */
  enableAuditLog?: boolean;
  /** Schema cache TTL in seconds. Default: 3600 (1 hour). */
  schemaCacheTtl?: number;
  /** Enable natural-language response formatting step. Default: true. */
  enableFormatting?: boolean;
  /** Multi-tenant data isolation configuration. */
  tenantScoping?: TenantScopingConfig;
  /** Enable query caching (exact and semantic). Default: true. */
  enableCaching?: boolean;
  /** Similarity threshold for semantic cache hits (0.0–1.0). Default: 0.95. */
  semanticCacheThreshold?: number;
  /**
   * TTL in seconds for Tier 3 result cache.
   * Set 0 to disable. Default: 300 (5 minutes).
   */
  queryResultCacheTtl?: number;
  /**
   * Per-tenant rate limiting. Requires a CacheProvider to be configured.
   */
  rateLimit?: {
    enabled: boolean;
    /** Max number of queries allowed in the window. */
    maxRequests: number;
    /** Time window in seconds (sliding window). */
    windowSeconds: number;
  };
}
```

### `TenantScopingConfig`

```typescript
interface TenantScopingConfig {
  /** Enable tenant isolation. Default: false. */
  enabled: boolean;
  /** The column used for scoping (e.g. 'organization_id', 'post_author'). */
  column: string;
  /**
   * Optional function to extract the tenant value from the context.
   * If omitted, context.tenantId is used directly.
   */
  getValue?: (ctx: TenantContext) => string | number;
}
```

### `TenantContext`

```typescript
interface TenantContext {
  /** Tenant identifier used for SQL scoping and audit logs. */
  tenantId?: string | number;
  /** Optional arbitrary metadata passed through the pipeline. */
  [key: string]: unknown;
}
```

### `AskResult`

```typescript
interface AskResult {
  /** Natural language answer (when formatting is enabled). */
  answer: string;
  /** Final scoped SQL that was executed. */
  sql: string;
  /** Query result rows (blocked columns already removed). */
  rows: Record<string, unknown>[];
  /** Total execution time in milliseconds. */
  executionMs: number;
  /** Token usage for this request. */
  tokenUsage?: { input: number; output: number };
  /** Whether a cached SQL result was returned. */
  fromCache?: boolean;
}
```

### `AskChokroError`

```typescript
class AskChokroError extends Error {
  readonly code: ErrorCode;
  readonly suggestion: string;
  readonly cause?: Error;
}

type ErrorCode =
  | 'SCHEMA_INTROSPECTION_FAILED'
  | 'SQL_GENERATION_FAILED'
  | 'SQL_VALIDATION_FAILED'
  | 'SQL_EXECUTION_FAILED'
  | 'SQL_EXECUTION_TIMEOUT'
  | 'TENANT_REWRITE_FAILED'
  | 'TENANT_REWRITE_UNSAFE'
  | 'RESPONSE_FORMATTING_FAILED'
  | 'MAX_RETRIES_EXCEEDED'
  | 'TENANT_ID_MISSING'
  | 'PROVIDER_ERROR'
  | 'CONFIGURATION_ERROR'
  | 'RATE_LIMIT_EXCEEDED';
```

### `PipelineHooks`

Intercept any stage of the pipeline without modifying core.

```typescript
interface PipelineHooks {
  beforeSchemaRead?: (ctx: TenantContext) => Promise<void>;
  afterSchemaRead?: (ctx: TenantContext, schema: FullSchema) => Promise<void>;

  beforePrompt?: (ctx: TenantContext, question: string) => Promise<string | void>;
  afterPrompt?: (ctx: TenantContext, prompt: string) => Promise<void>;

  beforeGenerateSQL?: (ctx: TenantContext, prompt: string) => Promise<void>;
  afterGenerateSQL?: (ctx: TenantContext, sql: string) => Promise<string | void>;

  beforeExecute?: (ctx: TenantContext, sql: string) => Promise<void>;
  afterExecute?: (ctx: TenantContext, sql: string, rows: Record<string, unknown>[]) => Promise<void>;

  beforeResponse?: (ctx: TenantContext, rows: Record<string, unknown>[]) => Promise<Record<string, unknown>[] | void>;
  afterResponse?: (ctx: TenantContext, result: AskResult) => Promise<void>;

  onError?: (ctx: TenantContext, error: Error) => Promise<void>;
}
```

**Example usage:**
```typescript
const agent = new AskChokro({
  hooks: {
    afterExecute: async (ctx, sql, rows) => {
      console.log(`[${ctx.tenantId}] SQL executed:`, sql, '→', rows.length, 'rows');
    },
    onError: async (ctx, err) => {
      Sentry.captureException(err);
    },
  },
});
```

### Audit Logging

When `enableAuditLog: true` is set, every pipeline execution emits a structured log entry to your configured `Logger`:

```typescript
// Example audit log entry (info level)
{
  event:       'askchokro:query_executed',
  tenantId:    'vendor_42',
  question:    'Show me sales from last week',
  sql:         'SELECT ... WHERE post_author = 42 ...',
  rowCount:    18,
  executionMs: 312,
  tokenUsage:  { input: 420, output: 87 },
  retryCount:  0,
}

// On failure (warn level)
{
  event:   'askchokro:query_failed',
  tenantId: 'vendor_42',
  error:    'SQL_EXECUTION_TIMEOUT',
  sql:      '...',
}
```

---

## Main Package

`@digitalchokro/askchokro` — Convenience wrapper with auto-detection.

### `AskChokro`

```typescript
import { AskChokro } from '@digitalchokro/askchokro';

// Auto-detects DATABASE_URL and AI provider API keys
const agent = new AskChokro();

// Explicit configuration
const agent = new AskChokro({
  db: new PostgresAdapter({ connectionString: process.env.DATABASE_URL }),
  ai: new GeminiProvider({ apiKey: process.env.GOOGLE_API_KEY }),
  options: {
    enableAuditLog: true,
    tenantScoping: {
      enabled: true,
      column: 'organization_id',
    },
    rateLimit: {
      enabled: true,
      maxRequests: 100,
      windowSeconds: 60,
    },
  },
});

const result = await agent.ask('Who are my top 5 customers?', { tenantId: 'org_123' });
```

---

## Database Adapters

### PostgreSQL (`@digitalchokro/db-postgres`)

```typescript
import { PostgresAdapter } from '@digitalchokro/db-postgres';

const db = new PostgresAdapter({
  connectionString: process.env.DATABASE_URL,
  // OR individual fields:
  host: 'localhost', port: 5432,
  user: 'postgres', password: '...', database: 'mydb',
  ssl: true,
});
```

### SQLite (`@digitalchokro/db-sqlite`)

```typescript
import { SqliteAdapter } from '@digitalchokro/db-sqlite';

const db = new SqliteAdapter({ filePath: './data.db' }); // or ':memory:'
```

### MySQL (`@digitalchokro/db-mysql`)

```typescript
import { MysqlAdapter } from '@digitalchokro/db-mysql';

const db = new MysqlAdapter({
  host: 'localhost', port: 3306,
  user: 'root', password: '...', database: 'mydb',
});
```

### SQL Server (`@digitalchokro/db-mssql`)

```typescript
import { MssqlAdapter } from '@digitalchokro/db-mssql';

const db = new MssqlAdapter({
  server: 'localhost',
  database: 'mydb',
  user: 'sa', password: '...',
  options: { encrypt: true },
});
```

---

## AI Providers

### OpenAI (`@digitalchokro/provider-openai`)

```typescript
import { OpenAIProvider } from '@digitalchokro/provider-openai';

const ai = new OpenAIProvider({
  apiKey: process.env.OPENAI_API_KEY,
  model: 'gpt-4o', // Default
});
```

**Recommended models:** `gpt-4o`, `gpt-4o-mini`, `o3-mini`

### Anthropic (`@digitalchokro/provider-anthropic`)

```typescript
import { AnthropicProvider } from '@digitalchokro/provider-anthropic';

const ai = new AnthropicProvider({
  apiKey: process.env.ANTHROPIC_API_KEY,
  model: 'claude-sonnet-4-5',
});
```

**Recommended models:** `claude-opus-4-5`, `claude-sonnet-4-5`, `claude-haiku-3-5`

### Google Gemini (`@digitalchokro/provider-gemini`)

```typescript
import { GeminiProvider } from '@digitalchokro/provider-gemini';

const ai = new GeminiProvider({
  apiKey: process.env.GOOGLE_API_KEY,
  model: 'gemini-2.5-pro', // Default
});
```

**Recommended models:** `gemini-2.5-pro`, `gemini-2.5-flash`, `gemini-2.0-flash`

### Google Vertex AI (`@digitalchokro/provider-vertex`)

```typescript
import { VertexAIProvider } from '@digitalchokro/provider-vertex';

const ai = new VertexAIProvider({
  projectId: process.env.GOOGLE_CLOUD_PROJECT,
  location: 'us-central1',
  model: 'gemini-2.5-pro',
  // Uses Application Default Credentials (ADC) automatically
});
```

### Ollama — Local Models (`@digitalchokro/provider-ollama`)

```typescript
import { OllamaProvider } from '@digitalchokro/provider-ollama';

const ai = new OllamaProvider({
  model: 'qwen3', // or 'qwen2.5', 'llama3.1', etc.
  baseURL: 'http://localhost:11434',
});
```

**Recommended local models:** `qwen3`, `qwen2.5`, `llama3.1`, `mistral`

---

## Web Framework Adapters

### Express (`@digitalchokro/adapter-express`)

```typescript
import { createAskChokroMiddleware, createAskChokroStreamMiddleware } from '@digitalchokro/adapter-express';

app.post('/api/ask', createAskChokroMiddleware(agent));
app.post('/api/ask/stream', createAskChokroStreamMiddleware(agent));
```

### Next.js App Router (`@digitalchokro/adapter-nextjs`)

```typescript
// app/api/ask/route.ts
import { createAskChokroRoute } from '@digitalchokro/adapter-nextjs';
export const POST = createAskChokroRoute(agent);
```

### Fastify (`@digitalchokro/adapter-fastify`)

```typescript
import { createAskChokroPlugin } from '@digitalchokro/adapter-fastify';
await fastify.register(createAskChokroPlugin(agent), { prefix: '/api' });
```

### Hono (`@digitalchokro/adapter-hono`)

```typescript
import { createAskChokroHandler } from '@digitalchokro/adapter-hono';
app.post('/api/ask', createAskChokroHandler(agent));
```

**Request format (all adapters):**
```json
POST /api/ask
{ "question": "How many orders shipped last week?", "tenantId": "org_123" }
```

**Response format:**
```json
{
  "answer": "42 orders were shipped last week.",
  "sql": "SELECT COUNT(*) FROM orders WHERE ...",
  "rows": [{ "count": 42 }],
  "executionMs": 187
}
```

---

## CLI Tool

`@digitalchokro/cli` — Instant demo and local setup.

```bash
# Run interactive demo (auto-detects provider)
npx @digitalchokro/cli demo

# Force a specific provider + model
ASKCHOKRO_PROVIDER=ollama ASKCHOKRO_MODEL=qwen3 npx @digitalchokro/cli demo
ASKCHOKRO_PROVIDER=gemini GOOGLE_API_KEY=... npx @digitalchokro/cli demo

# Show help
npx @digitalchokro/cli --help
```

---

## WordPress Plugin

The official `askchokro` WordPress plugin connects any WordPress/WooCommerce site to the AskChokro microservice.

### Settings

Configure under **Settings → AskChokro**:
- **Microservice URL** — Your deployed Node.js microservice endpoint (e.g. `https://api.example.com/api/ask`)
- **API Token** — The JWT secret shared between WordPress and the microservice

### Shortcode

```
[askchokro_chat]
```

Embeds the full chat interface anywhere on your site.

### Multi-Tenant / Multi-Vendor Isolation (Phase 3)

The plugin automatically detects the logged-in vendor via Dokan (`dokan_is_user_seller`) or WCFM (`wcfm_is_vendor`). It generates a **short-lived signed JWT** (1-hour expiry) containing the `vendor_id`, which is passed as the `Authorization: Bearer` token. The Node.js microservice uses this to scope all SQL to `WHERE post_author = <vendor_id>` automatically.

No frontend changes needed — isolation is fully transparent.

---

## Vector Memory

`@digitalchokro/vector-memory` — Semantic caching backend.

```typescript
import { InMemoryVectorStore } from '@digitalchokro/vector-memory';

const vectorStore = new InMemoryVectorStore();
// Pass to AgentConfig.vectorStore to enable Tier 2 semantic cache
```

---

## Error Handling

```typescript
import { AskChokroError } from '@digitalchokro/core';

try {
  const result = await agent.ask(question, { tenantId: 'org_123' });
} catch (err) {
  if (err instanceof AskChokroError) {
    switch (err.code) {
      case 'RATE_LIMIT_EXCEEDED':
        res.status(429).json({ error: err.message, suggestion: err.suggestion });
        break;
      case 'TENANT_ID_MISSING':
        res.status(400).json({ error: err.message });
        break;
      case 'SQL_EXECUTION_TIMEOUT':
        res.status(504).json({ error: 'Query timed out' });
        break;
      default:
        res.status(500).json({ error: err.message, code: err.code });
    }
  }
}
```

---

## Environment Variables

```bash
# ── AI Providers ──────────────────────────────────
OPENAI_API_KEY=sk-...
ANTHROPIC_API_KEY=sk-ant-...
GOOGLE_API_KEY=...                  # For Gemini
GOOGLE_CLOUD_PROJECT=my-project     # For Vertex AI
GOOGLE_CLOUD_LOCATION=us-central1  # For Vertex AI
OLLAMA_BASE_URL=http://localhost:11434

# ── Database ──────────────────────────────────────
DATABASE_URL=postgresql://user:pass@host/db

# ── Auto-Detection (CLI / AskChokro wrapper) ──────
ASKCHOKRO_PROVIDER=gemini           # openai | anthropic | gemini | vertex | ollama
ASKCHOKRO_MODEL=gemini-2.5-pro

# ── Microservice ──────────────────────────────────
JWT_SECRET=your-secret              # Bearer token verification
ENABLE_TENANT_SCOPING=true
TENANT_COLUMN=post_author           # WooCommerce vendor column
PORT=3000
```

---

## Version Support

| Runtime    | Version   |
|------------|-----------|
| Node.js    | ≥ 18.0.0 |
| TypeScript | ≥ 5.5.0  |
| pnpm       | ≥ 9.0.0  |

---

## Additional Resources

- [ARCHITECTURE.md](./ARCHITECTURE.md) — System design and 3-tier caching model
- [TESTING.md](./TESTING.md) — Test strategy and evaluation harness
- [docs/SECURITY.md](./docs/SECURITY.md) — 9-layer security model
- [docs/WORDPRESS_INTEGRATION.md](./docs/WORDPRESS_INTEGRATION.md) — WordPress setup guide
- [docs/QUICK_START.md](./docs/QUICK_START.md) — 5-minute integration guide
- [docs/adr/](./docs/adr/) — Architecture Decision Records
