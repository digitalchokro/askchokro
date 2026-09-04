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

// SQL guards — shared with providers so the CANNOT_ANSWER sentinel is
// recognised identically everywhere instead of by ad-hoc string comparison.
export { applyRowLimit, isCannotAnswer, CANNOT_ANSWER_SQL } from './pipeline/sql-guards.js';
export { toParserDialect, usesTopSyntax } from './pipeline/dialect.js';

// Token accounting — providers collect counts here so the agent can report them.
export { UsageAccumulator } from './pipeline/usage.js';

// Cache providers
export { InMemoryCacheProvider } from './providers/memory-cache.js';

// Hooks
export type { PipelineHooks } from './pipeline/hooks.js';

// All interfaces — for plugin/adapter authors
export type {
  AIProvider,
  TokenUsage,
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
  VectorDatabaseAdapter,
  VectorSearchResult,
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

export { isChartConfig } from './types/index.js';
