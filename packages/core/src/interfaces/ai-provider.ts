/**
 * @digitalchokro/core — AI Provider Interface
 *
 * Every AI provider (Ollama, OpenAI, Gemini, Anthropic, etc.) implements this
 * contract. The core engine never imports any specific AI SDK — it only talks
 * to this interface.
 */

import type { RelevantSchema } from '../types/schema.js';
import type { ChartConfig } from '../types/result.js';

/** Prompt and completion token counts reported by a provider. */
export interface TokenUsage {
  input: number;
  output: number;
}

export interface AIProvider {
  /** A human-readable identifier for this provider (e.g., 'ollama', 'openai'). */
  readonly name: string;

  /**
   * Given a natural-language prompt (which includes the schema context and
   * the user's question), generate a single SQL query string.
   *
   * The returned SQL must be a valid SELECT statement for the target dialect.
   * The core pipeline will validate the output using the SQLValidator before
   * execution — if validation fails, this method may be called again as part
   * of the retry loop.
   */
  generateSQL(prompt: string, schema: RelevantSchema): Promise<string>;

  /**
   * Given the original question, the generated SQL, and the raw result rows,
   * produce a human-readable natural-language answer, and optionally a chart configuration.
   *
   * This method is optional in the pipeline — developers can disable it to
   * save cost/latency when they only need the raw SQL and rows.
   */
  formatResponse(
    question: string,
    sql: string,
    rows: Record<string, unknown>[],
    ragContext?: import('./vector-database.js').VectorSearchResult[],
  ): Promise<{ answer: string; chart?: ChartConfig }>;

  /**
   * Same as formatResponse, but returns an AsyncIterable for streaming the natural
   * language response to the client in real-time.
   */
  streamResponse?(
    question: string,
    sql: string,
    rows: Record<string, unknown>[],
    ragContext?: import('./vector-database.js').VectorSearchResult[],
  ): AsyncIterable<{ content?: string; chart?: ChartConfig; done?: boolean }>;

  /**
   * Return the token usage accumulated since the last call and reset the
   * counter — a drain, not a peek. The agent calls this after each generation
   * and after formatting so that `AskResult.tokenUsage` reflects every call
   * made for one question, including retries.
   *
   * Optional: providers that cannot report usage (most local models) simply
   * omit it, and `tokenUsage` stays at zero rather than being guessed at.
   */
  consumeUsage?(): TokenUsage;

  /**
   * Clean up any resources held by the provider (e.g., HTTP connections).
   * Called when the DatabaseAgent is disposed.
   */
  dispose?(): Promise<void>;
}
