/**
 * @askchokro/core — Database Adapter Interface
 *
 * Every database adapter (Postgres, MySQL, SQLite) implements this contract.
 * The core engine never imports any specific database driver — it only talks
 * to this interface.
 */

export type Dialect = 'postgres' | 'mysql' | 'sqlite';

export interface QueryResult {
  /** The result rows as an array of plain objects. */
  rows: Record<string, unknown>[];
  /** Number of rows returned. */
  rowCount: number;
  /** Wall-clock execution time in milliseconds. */
  executionMs: number;
}

export interface DatabaseAdapter {
  /** The SQL dialect this adapter targets. Used by the AST parser. */
  readonly dialect: Dialect;

  /** A human-readable identifier (e.g., 'postgres', 'sqlite'). */
  readonly name: string;

  /**
   * Execute a read-only SQL query and return the result rows.
   *
   * Implementations should:
   * - Use parameterized queries where the sandbox passes parameters.
   * - Enforce a query timeout (via driver-level settings or AbortController).
   * - Never allow execution of DDL or DML statements — though the core
   *   pipeline validates this upstream via the SQLValidator.
   */
  execute(sql: string, params?: unknown[]): Promise<QueryResult>;

  /**
   * Return raw schema metadata from information_schema or equivalent.
   * The SchemaReader will call this during introspection.
   */
  introspectSchema(): Promise<RawSchemaResult>;

  /**
   * Release the database connection / connection pool.
   */
  close(): Promise<void>;
}

export interface RawSchemaResult {
  tables: RawTableInfo[];
}

export interface RawTableInfo {
  tableName: string;
  tableSchema: string;
  columns: RawColumnInfo[];
  foreignKeys: RawForeignKeyInfo[];
}

export interface RawColumnInfo {
  columnName: string;
  dataType: string;
  isNullable: boolean;
  columnDefault: string | null;
  isPrimaryKey: boolean;
}

export interface RawForeignKeyInfo {
  constraintName: string;
  columnName: string;
  referencedTable: string;
  referencedColumn: string;
}
