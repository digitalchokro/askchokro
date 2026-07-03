/**
 * @digitalchokro/core — Public API
 *
 * Everything exported from this file is the public contract.
 * Consumers do: import { DatabaseAgent } from '@digitalchokro/core'
 */

// The main agent
export { DatabaseAgent } from './pipeline/agent.js';

// Error class
export { AskChokroError } from './pipeline/errors.js';
export type { ErrorCode } from './pipeline/errors.js';

// SQL Validator & Rewriter
export { DefaultSQLValidator } from './pipeline/sql-validator.js';
export { DefaultTenantScopeRewriter } from './pipeline/tenant-rewriter.js';

// Hooks
export type { PipelineHooks } from './pipeline/hooks.js';

// All interfaces — for plugin/adapter authors
export type {
  AIProvider,
  DatabaseAdapter,
  Dialect,
  QueryResult,
  RawSchemaResult,
  RawTableInfo,
  RawColumnInfo,
  RawForeignKeyInfo,
  SQLValidator,
  ValidationResult,
  TenantScopeRewriter,
  TenantRewriteResult,
  SchemaProvider,
  PromptStrategy,
  PromptPayload,
  ResultFormatter,
  CacheProvider,
  Logger,
  TelemetryProvider,
  TelemetryEvent,
} from './interfaces/index.js';

// All types — for consumers
export type {
  FullSchema,
  RelevantSchema,
  TableInfo,
  ColumnInfo,
  ForeignKey,
  TenantContext,
  AskResult,
  ChartConfig,
  AgentConfig,
  AgentOptions,
  TenantScopingConfig,
} from './types/index.js';
