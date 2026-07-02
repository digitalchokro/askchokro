/**
 * @digitalchokro/core — SQL Validator Interface
 *
 * Validates generated SQL using AST parsing, NOT regex or keyword matching.
 * See ADR 002 for the rationale.
 */

export interface ValidationResult {
  /** Whether the SQL passed all safety checks. */
  valid: boolean;
  /** If invalid, the specific reason for rejection. */
  reason?: string;
  /** The type of violation detected (if any). */
  violationType?: 'destructive_statement' | 'blocked_table' | 'blocked_column' | 'parse_error' | 'unsupported_syntax';
}

export interface SQLValidator {
  /**
   * Parse the SQL string into an AST and verify it is a safe, read-only
   * SELECT statement that does not reference blocked tables or columns.
   *
   * Implementations must:
   * - Use a proper SQL AST parser (e.g., node-sql-parser), not string matching.
   * - Be dialect-aware (Postgres, MySQL, SQLite have different grammars).
   * - Reject any statement type other than SELECT.
   * - Check all table references against the allow/blocklist.
   * - Check all column references against the blocked columns list.
   * - Return a clear, actionable reason on failure.
   */
  validate(
    sql: string,
    dialect: string,
    allowedTables?: string[],
    blockedTables?: string[],
    blockedColumns?: string[],
  ): ValidationResult;
}
