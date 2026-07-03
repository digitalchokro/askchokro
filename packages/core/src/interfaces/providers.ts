/**
 * @digitalchokro/core — Remaining Interfaces
 *
 * SchemaProvider, PromptStrategy, ResultFormatter, CacheProvider,
 * Logger, and TelemetryProvider.
 */

import type { FullSchema, RelevantSchema } from '../types/schema.js';
import type { TenantContext } from '../types/context.js';

// ─── Schema Provider ─────────────────────────────────────────────────────────

export interface SchemaProvider {
  /** Introspect the database and return the full schema metadata. */
  introspect(): Promise<FullSchema>;
}

// ─── Prompt Strategy ─────────────────────────────────────────────────────────

export interface PromptPayload {
  /** The system prompt including schema context and instructions. */
  systemPrompt: string;
  /** The user's question, sanitized and isolated. */
  userPrompt: string;
  /** The relevant schema tables selected for this question. */
  relevantSchema: RelevantSchema;
}

export interface PromptStrategy {
  /**
   * Select the most relevant tables from the full schema for the given
   * question, inject tenant scoping context, and build the final prompt
   * payload to send to the AI provider.
   */
  build(
    question: string,
    schema: FullSchema,
    context: TenantContext,
    annotations?: Record<string, string>,
    ragContext?: import('./vector-database.js').VectorSearchResult[],
  ): PromptPayload;
}

// ─── Result Formatter ────────────────────────────────────────────────────────

export interface ResultFormatter {
  /**
   * Convert raw SQL result rows into a human-readable natural-language answer.
   * This step is optional — developers can disable it to save cost.
   */
  format(
    question: string,
    sql: string,
    rows: Record<string, unknown>[],
  ): Promise<string>;
}

// ─── Cache Provider ──────────────────────────────────────────────────────────

export interface CacheProvider {
  get<T>(key: string): Promise<T | null>;
  set<T>(key: string, value: T, ttlSeconds?: number): Promise<void>;
  delete(key: string): Promise<void>;
  clear(): Promise<void>;
}

// ─── Logger ──────────────────────────────────────────────────────────────────

export interface Logger {
  debug(message: string, meta?: Record<string, unknown>): void;
  info(message: string, meta?: Record<string, unknown>): void;
  warn(message: string, meta?: Record<string, unknown>): void;
  error(message: string, meta?: Record<string, unknown>): void;
}

// ─── Telemetry Provider ──────────────────────────────────────────────────────

export interface TelemetryEvent {
  type:
    | 'schema_read'
    | 'prompt_built'
    | 'sql_generated'
    | 'sql_rejected'
    | 'tenant_rewrite'
    | 'sql_executed'
    | 'response_formatted'
    | 'retry'
    | 'error';
  durationMs: number;
  tokenUsage?: { input: number; output: number };
  retryCount?: number;
  cacheHit?: boolean;
  tenantId?: string;
  userId?: string;
  sqlGenerated?: string;
  error?: string;
}

export interface TelemetryProvider {
  emit(event: TelemetryEvent): void;
}
