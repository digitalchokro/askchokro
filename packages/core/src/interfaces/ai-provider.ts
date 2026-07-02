/**
 * @digitalchokro/core — AI Provider Interface
 *
 * Every AI provider (Ollama, OpenAI, Gemini, Anthropic, etc.) implements this
 * contract. The core engine never imports any specific AI SDK — it only talks
 * to this interface.
 */

import type { RelevantSchema } from '../types/schema.js';

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
   * produce a human-readable natural-language answer.
   *
   * This method is optional in the pipeline — developers can disable it to
   * save cost/latency when they only need the raw SQL and rows.
   */
  formatResponse(
    question: string,
    sql: string,
    rows: Record<string, unknown>[],
  ): Promise<string>;

  /**
   * Clean up any resources held by the provider (e.g., HTTP connections).
   * Called when the DatabaseAgent is disposed.
   */
  dispose?(): Promise<void>;
}
