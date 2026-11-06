/**
 * @digitalchokro/db-duckdb — DuckDB Database Adapter
 *
 * Implements the DatabaseAdapter interface for DuckDB using `@duckdb/node-api`.
 * DuckDB is an embedded analytical (OLAP) database engine, optimized for
 * fast aggregations, columnar queries, and direct querying of Parquet, CSV,
 * and JSON files.
 */

import type {
  DatabaseAdapter,
  QueryResult,
  RawSchemaResult,
  RawTableInfo,
  RawColumnInfo,
  RawForeignKeyInfo,
  TenantContext,
} from '@digitalchokro/core';
import { DuckDBInstance, type DuckDBConnection } from '@duckdb/node-api';

export interface DuckDBAdapterConfig {
  /** Path to the DuckDB database file, or ':memory:' for in-memory (default: ':memory:'). */
  path?: string;
  /** Optional read-only flag. When true, opens the database file in READ_ONLY mode. */
  readOnly?: boolean;
}

function normalizeDuckDBValue(val: unknown): unknown {
  if (val === null || val === undefined) return val;
  if (typeof val === 'bigint') {
    if (val >= BigInt(Number.MIN_SAFE_INTEGER) && val <= BigInt(Number.MAX_SAFE_INTEGER)) {
      return Number(val);
    }
    return val.toString();
  }
  if (typeof val === 'object') {
    if (val.constructor && val.constructor.name.startsWith('DuckDB') && typeof (val as any).toString === 'function') {
      return (val as any).toString();
    }
    if (Array.isArray(val)) {
      return val.map(normalizeDuckDBValue);
    }
  }
  return val;
}

export class DuckDBAdapter implements DatabaseAdapter {
  readonly dialect = 'duckdb' as const;
  readonly name = 'duckdb';

  private dbPromise: Promise<DuckDBInstance>;
  private connPromise: Promise<DuckDBConnection>;
  private isClosed = false;

  constructor(config: DuckDBAdapterConfig = {}) {
    const dbPath = config.path || ':memory:';
    const options: Record<string, string> = {};
    if (config.readOnly) {
      options.access_mode = 'READ_ONLY';
    }

    this.dbPromise = DuckDBInstance.create(dbPath, options);
    this.connPromise = this.dbPromise.then((db) => db.connect());
  }

  private async getConnection(): Promise<DuckDBConnection> {
    if (this.isClosed) {
      throw new Error('[AskChokro] DuckDB connection is closed');
    }
    return this.connPromise;
  }

  async execute(sql: string, params: unknown[] = [], context?: TenantContext): Promise<QueryResult> {
    const start = performance.now();
    const readOnly = context?.metadata?.readOnly === true;

    // Read-only boundary backstop
    if (readOnly) {
      const trimmed = sql.trim().toLowerCase();
      const forbidden = ['insert ', 'update ', 'delete ', 'drop ', 'alter ', 'create ', 'truncate '];
      if (forbidden.some((f) => trimmed.startsWith(f))) {
        throw new Error('read-only mode: refusing to execute a non-SELECT statement');
      }
    }

    try {
      const conn = await this.getConnection();

      let rawRows: Record<string, unknown>[] = [];
      if (Array.isArray(params) && params.length > 0) {
        const stmt = await conn.prepare(sql);
        stmt.bind(params as any);
        const reader = await stmt.runAndReadAll();
        rawRows = reader.getRowObjects() as Record<string, unknown>[];
      } else {
        const reader = await conn.runAndReadAll(sql);
        rawRows = reader.getRowObjects() as Record<string, unknown>[];
      }

      const rows = rawRows.map((row) => {
        const normalized: Record<string, unknown> = {};
        for (const [key, value] of Object.entries(row)) {
          normalized[key] = normalizeDuckDBValue(value);
        }
        return normalized;
      });

      return {
        rows,
        rowCount: rows.length,
        executionMs: performance.now() - start,
      };
    } catch (err: unknown) {
      if (err instanceof Error && err.message.startsWith('read-only mode:')) {
        throw err;
      }
      throw new Error(`[AskChokro] DuckDB execution error: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  async introspectSchema(): Promise<RawSchemaResult> {
    const conn = await this.getConnection();

    const tablesQuery = `
      SELECT table_name, table_schema
      FROM information_schema.tables
      WHERE table_schema NOT IN ('information_schema', 'pg_catalog')
      ORDER BY table_name
    `;

    const tablesReader = await conn.runAndReadAll(tablesQuery);
    const tables = tablesReader.getRowObjects() as { table_name: string; table_schema: string }[];

    // Fetch constraints for PK and FK mapping
    let constraints: any[] = [];
    try {
      const constraintsReader = await conn.runAndReadAll(`
        SELECT
          constraint_type,
          table_name,
          schema_name,
          constraint_name,
          constraint_column_names,
          referenced_table,
          referenced_column_names
        FROM duckdb_constraints()
      `);
      constraints = constraintsReader.getRowObjects();
    } catch {
      // Fallback if duckdb_constraints is unavailable in certain modes
      constraints = [];
    }

    const resultTables: RawTableInfo[] = [];

    for (const t of tables) {
      const tableName = String(t.table_name || '');
      const tableSchema = String(t.table_schema || 'main');

      // Identify primary keys for this table
      const pkColumns = new Set<string>();
      const foreignKeys: RawForeignKeyInfo[] = [];

      for (const c of constraints) {
        if (c.table_name === tableName && (c.schema_name === tableSchema || !c.schema_name)) {
          const rawColNames = c.constraint_column_names?.items || c.constraint_column_names || [];
          const colNames = Array.isArray(rawColNames) ? rawColNames : [String(rawColNames)];

          if (c.constraint_type === 'PRIMARY KEY') {
            for (const col of colNames) {
              pkColumns.add(String(col));
            }
          } else if (c.constraint_type === 'FOREIGN KEY' && c.referenced_table) {
            const rawRefCols = c.referenced_column_names?.items || c.referenced_column_names || [];
            const refCols = Array.isArray(rawRefCols) ? rawRefCols : [String(rawRefCols)];

            colNames.forEach((col: string, idx: number) => {
              foreignKeys.push({
                constraintName: String(c.constraint_name || `fk_${tableName}_${col}`),
                columnName: String(col),
                referencedTable: String(c.referenced_table),
                referencedColumn: String(refCols[idx] || refCols[0] || 'id'),
              });
            });
          }
        }
      }

      const columnsStmt = await conn.prepare(`
        SELECT column_name, data_type, is_nullable, column_default
        FROM information_schema.columns
        WHERE table_name = ? AND table_schema = ?
        ORDER BY ordinal_position
      `);
      columnsStmt.bind([tableName, tableSchema]);
      const columnsReader = await columnsStmt.runAndReadAll();
      const cols = columnsReader.getRowObjects() as any[];

      const columns: RawColumnInfo[] = cols.map((col) => {
        const cName = String(col.column_name || '');
        const dType = String(col.data_type || '');
        const nullable = (col.is_nullable || '').toUpperCase() === 'YES';
        const dflt = col.column_default !== null && col.column_default !== undefined ? String(col.column_default) : null;

        return {
          columnName: cName,
          dataType: dType,
          isNullable: nullable,
          isPrimaryKey: pkColumns.has(cName),
          columnDefault: dflt,
        };
      });

      resultTables.push({
        tableName,
        tableSchema,
        columns,
        foreignKeys,
      });
    }

    return { tables: resultTables };
  }

  async close(): Promise<void> {
    if (this.isClosed) return;
    this.isClosed = true;

    try {
      const conn = await this.connPromise;
      conn.closeSync();
      const db = await this.dbPromise;
      db.closeSync();
    } catch {
      // Ignore errors on idempotent shutdown
    }
  }
}
