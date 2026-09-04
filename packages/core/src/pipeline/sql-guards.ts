/**
 * @digitalchokro/core — Guards applied to generated SQL
 *
 * Two guards run between validation and execution:
 *
 *  - `applyRowLimit` enforces the `maxRows` cap. This is a hard resource
 *    guard, so it must survive queries that merely *mention* a limit: a
 *    string literal like `WHERE note = 'LIMIT'`, or a column named
 *    `limit_price`, must not switch the cap off. It also clamps a limit the
 *    model chose for itself, so `LIMIT 1000000` cannot outrank `maxRows`.
 *
 *  - `isCannotAnswer` recognises the sentinel the model returns when it
 *    declines to answer. Matching has to be tolerant of reformatting,
 *    because the tenant rewriter round-trips SQL through the AST and
 *    re-quotes identifiers per dialect (`AS error` becomes `AS "error"` on
 *    Postgres and `AS [error]` on SQL Server).
 */

import { usesTopSyntax } from './dialect.js';

/** The sentinel the prompt asks the model to emit when it cannot answer. */
export const CANNOT_ANSWER_SQL = "SELECT 'CANNOT_ANSWER' AS error";

/**
 * A real trailing row-count clause. Anchored to the end of the statement so
 * that `LIMIT` inside a string literal or a subquery is never mistaken for
 * one. Covers `LIMIT n`, `LIMIT n OFFSET m`, and MySQL's `LIMIT offset, n`.
 */
const TRAILING_LIMIT = /\blimit\s+(\d+)(\s*,\s*(\d+))?(\s+offset\s+\d+)?\s*$/i;

/**
 * A leading `SELECT TOP n` / `SELECT DISTINCT TOP (n)` in T-SQL. The row count
 * is captured whole — `5000` or `(5000)` — so that the match ends at the count
 * and the whitespace before the select list is left for the caller to keep.
 */
const LEADING_TOP = /^(\s*select\s+(?:distinct\s+|all\s+)?)top\s*(\(\s*\d+\s*\)|\d+)/i;

/** `SELECT` plus any leading set quantifier, used as the insertion point for TOP. */
const SELECT_HEAD = /^(\s*select\s+(?:distinct\s+|all\s+)?)/i;

/** Strip a trailing semicolon and surrounding whitespace. */
function stripTerminator(sql: string): string {
  return sql.trimEnd().replace(/;+\s*$/, '').trimEnd();
}

/**
 * Cap the rows a generated query can return at `maxRows`.
 *
 * An existing row-count clause is clamped rather than trusted, and a query
 * with no clause gets one appended. Returns SQL with no trailing semicolon.
 */
export function applyRowLimit(sql: string, maxRows: number, dialect: string): string {
  const clean = stripTerminator(sql);

  if (usesTopSyntax(dialect)) {
    const existing = LEADING_TOP.exec(clean);
    if (existing) {
      const requested = Number(existing[2]?.replace(/[()\s]/g, ''));
      const capped = Math.min(requested, maxRows);
      return clean.replace(LEADING_TOP, `$1TOP ${capped}`);
    }
    // No TOP clause — insert one directly after SELECT [DISTINCT | ALL].
    if (SELECT_HEAD.test(clean)) {
      return clean.replace(SELECT_HEAD, `$1TOP ${maxRows} `);
    }
    return clean;
  }

  const existing = TRAILING_LIMIT.exec(clean);
  if (existing) {
    // `LIMIT offset, count` puts the row count second; `LIMIT count` first.
    const isOffsetForm = existing[3] !== undefined;
    const requested = Number(isOffsetForm ? existing[3] : existing[1]);
    const capped = Math.min(requested, maxRows);
    const replacement = isOffsetForm
      ? `LIMIT ${existing[1]}, ${capped}${existing[4] ?? ''}`
      : `LIMIT ${capped}${existing[4] ?? ''}`;
    return clean.replace(TRAILING_LIMIT, replacement);
  }

  return `${clean} LIMIT ${maxRows}`;
}

/**
 * True when the model declined to answer with SQL.
 *
 * Compares against the sentinel after normalising whitespace and stripping
 * dialect-specific identifier quoting, so an AST round-trip cannot hide it.
 */
export function isCannotAnswer(sql: string): boolean {
  const normalized = stripTerminator(sql)
    .replace(/[`"[\]]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toUpperCase();

  return normalized === CANNOT_ANSWER_SQL.toUpperCase();
}
