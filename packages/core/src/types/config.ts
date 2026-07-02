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
}

export interface AgentConfig {
  /** The database connection. Required. */
  db: DatabaseAdapter;
  /** The AI provider for SQL generation. Required. */
  ai: AIProvider;
  /** Custom schema introspection. Optional — default reads from the db adapter. */
  schema?: SchemaProvider;
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
