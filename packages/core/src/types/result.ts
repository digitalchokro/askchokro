/**
 * @askchokro/core — Result Types
 */

export interface AskResult {
  /** The natural-language answer. Null if formatting is disabled. */
  answer: string | null;
  /** The generated SQL query that was executed. */
  sql: string;
  /** The raw result rows from the database. */
  rows: Record<string, unknown>[];
  /** Total wall-clock execution time in milliseconds. */
  executionMs: number;
  /** Token usage across all AI calls for this question. */
  tokenUsage: { input: number; output: number };
  /** Number of retry attempts (0 if first attempt succeeded). */
  retryCount: number;
}
