/**
 * @digitalchokro/core — Agent Configuration Types
 */

import type { AIProvider } from '../interfaces/ai-provider.js';
import type { DatabaseAdapter } from '../interfaces/db-adapter.js';
import type {
  SchemaProvider,
  PromptStrategy,
  ResultFormatter,
  CacheProvider,
  Logger,
  TelemetryProvider,
} from '../interfaces/providers.js';
import type { SQLValidator } from '../interfaces/sql-validator.js';
import type { TenantScopeRewriter } from '../interfaces/tenant-rewriter.js';
import type { TenantContext } from './context.js';

export interface TenantScopingConfig {
  enabled: boolean;
  /** The column name used for tenant isolation (e.g., 'business_id', 'org_id'). */
  column: string;
  /** Extracts the tenant value from the request context. */
  getValue: (ctx: TenantContext) => string | number;
  /** If set, only these tables are tenant-scoped. Otherwise, all tables are scoped. */
  scopedTables?: string[];
}

export interface AgentOptions {
  /** Enforce read-only. Default: true. This must never be set to false. */
  readOnly?: boolean;
  /** Maximum rows returned per query. Default: 200. */
  maxRows?: number;
  /** Maximum AI retry attempts on SQL validation failure. Default: 2. */
  maxRetries?: number;
  /** Database query timeout in milliseconds. Default: 10_000. */
  queryTimeoutMs?: number;
  /** Only these tables can be queried. AI never sees other tables. */
  allowedTables?: string[];
  /** These tables are invisible to the AI. */
  blockedTables?: string[];
  /** These columns are stripped from schema context AND result rows. */
  blockedColumns?: string[];
  /** Enable full audit logging of questions, SQL, and results. */
  enableAuditLog?: boolean;
  /** Schema cache TTL in seconds. Default: 3600 (1 hour). */
  schemaCacheTtl?: number;
  /** Enable the natural-language response formatting step. Default: true. */
  enableFormatting?: boolean;
  /** Multi-tenant data isolation configuration. */
  tenantScoping?: TenantScopingConfig;
  /** Enable query caching (exact and semantic). Default: true. */
  enableCaching?: boolean;
  /** Similarity threshold for semantic cache hits (0.0 to 1.0). Default: 0.95. */
  semanticCacheThreshold?: number;
  /**
   * TTL in seconds for caching raw DB query results (Tier 3 cache).
   * Set to 0 to disable result caching. Default: 300 (5 minutes).
   * Ideal for dashboards: repeated SQL queries return instantly without hitting the DB.
   */
  queryResultCacheTtl?: number;
  /** Rate limiting configuration per tenant. */
  rateLimit?: {
    enabled: boolean;
    /** Maximum number of queries allowed within the window. */
    maxRequests: number;
    /** The time window in seconds. Note: acts as a sliding window of inactivity. */
    windowSeconds: number;
  };
  /** IP Whitelist configuration. If enabled, only listed IPs can query. */
  ipWhitelist?: {
    enabled: boolean;
    allowedIps: string[];
  };
  /** Row-Level Security configuration. Enables native database RLS. */
  rls?: {
    enabled: boolean;
    /** Whether to enforce RLS by setting a DB session variable before querying. Default is false. */
    setSessionVariable?: boolean;
    /** The session variable key (e.g. 'app.current_tenant'). */
    sessionVariableKey?: string;
  };
}

export interface AgentConfig {
  /** The database connection. Required. */
  db: DatabaseAdapter;
  /** The AI provider for SQL generation. Required. */
  ai: AIProvider;
  /** Custom schema introspection. Optional — default reads from the db adapter. */
  schema?: SchemaProvider;
  /** Vector Database adapter for RAG (Retrieval-Augmented Generation). Optional. */
  vectorDb?: import('../interfaces/vector-database.js').VectorDatabaseAdapter;
  /** Custom prompt building strategy. Optional. */
  prompt?: PromptStrategy;
  /** Custom SQL validator. Optional — default uses AST-based validator. */
  validator?: SQLValidator;
  /** Custom tenant scope rewriter. Optional — default uses AST-level rewriter. */
  tenantRewriter?: TenantScopeRewriter;
  /** Custom result formatter. Optional — default delegates to AI provider. */
  formatter?: ResultFormatter;
  /** Custom cache provider. Optional — default uses in-memory cache. */
  cache?: CacheProvider;
  /** Custom logger. Optional — default logs to console. */
  logger?: Logger;
  /** Custom telemetry provider. Optional — disabled by default. */
  telemetry?: TelemetryProvider;
  /** Agent behavior options. */
  options?: AgentOptions;
}
