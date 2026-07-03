/**
 * @digitalchokro/core — Result Types
 */

export interface ChartConfig {
  /** The type of chart to render */
  type: 'bar' | 'line' | 'pie';
  /** The key in the rows array to use for the X-axis (or name/label) */
  xAxisKey: string;
  /** The keys in the rows array to use for the Y-axis (the data values) */
  yAxisKeys: string[];
}

export interface AskResult {
  /** The natural-language answer. Null if formatting is disabled. */
  answer: string | null;
  /** The generated chart configuration, if the AI determined a chart is appropriate. */
  chart?: ChartConfig;
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
