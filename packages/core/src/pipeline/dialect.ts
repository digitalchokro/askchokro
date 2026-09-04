/**
 * @digitalchokro/core — Dialect mapping
 *
 * Our public `Dialect` union does not match the database names that
 * node-sql-parser accepts: we expose 'postgres' and 'mssql', the parser wants
 * 'postgresql' and 'transactsql'. Passing our name straight through makes the
 * parser throw ("mssql is not supported currently"), which surfaces as a
 * parse_error on every single query for that adapter.
 *
 * Every call into node-sql-parser must go through `toParserDialect`.
 */

import type { Dialect } from '../interfaces/db-adapter.js';

const PARSER_DIALECTS: Record<Dialect, string> = {
  postgres: 'postgresql',
  mssql: 'transactsql',
  mysql: 'mysql',
  sqlite: 'sqlite',
};

/** Translate a `Dialect` into the database name node-sql-parser expects. */
export function toParserDialect(dialect: string): string {
  return PARSER_DIALECTS[dialect as Dialect] ?? dialect;
}

/**
 * True for dialects that cap rows with `SELECT TOP n` instead of a trailing
 * `LIMIT n`. SQL Server rejects `LIMIT` outright.
 */
export function usesTopSyntax(dialect: string): boolean {
  return dialect === 'mssql';
}
