/**
 * @digitalchokro/db-sqlite — SQLite Database Adapter
 *
 * Implements the DatabaseAdapter interface for SQLite using `better-sqlite3`.
 * SQLite is the recommended adapter for local demos and development —
 * zero database setup, works offline, instant startup.
 *
 * v0 stub — full implementation in Milestone 1.
 */

import type {
  DatabaseAdapter,
  QueryResult,
  RawSchemaResult,
  RawTableInfo,
  RawColumnInfo,
  RawForeignKeyInfo,
} from '@digitalchokro/core';
import Database from 'better-sqlite3';

export interface SQLiteAdapterConfig {
  /** Path to the SQLite database file, or ':memory:' for in-memory. */
  path: string;
}

export class SQLiteAdapter implements DatabaseAdapter {
  readonly dialect = 'sqlite' as const;
  readonly name = 'sqlite';

  private config: SQLiteAdapterConfig;
  private db: Database.Database;

  constructor(config: SQLiteAdapterConfig) {
    this.config = config;
    this.db = new Database(config.path);
  }

  async execute(sql: string, params: unknown[] = []): Promise<QueryResult> {
    const start = performance.now();
    try {
      const stmt = this.db.prepare(sql);
      
      // If it's a SELECT, we want rows.
      if (stmt.reader) {
        const rows = stmt.all(...params) as Record<string, unknown>[];
        return { rows, rowCount: rows.length, executionMs: performance.now() - start };
      } else {
        const info = stmt.run(...params);
        return { rows: [], rowCount: info.changes, executionMs: performance.now() - start };
      }
    } catch (e: unknown) {
      if (e instanceof Error && e.message.includes('more than one statement') && params.length === 0) {
        this.db.exec(sql);
        return { rows: [], rowCount: 0, executionMs: performance.now() - start };
      }
      throw new Error(`[AskChokro] SQLite execution error: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  async introspectSchema(): Promise<RawSchemaResult> {
    const tables = this.db.prepare(
      `SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'`
    ).all() as { name: string }[];

    const resultTables: RawTableInfo[] = [];

    for (const t of tables) {
      const tableName = t.name;
      
      // Get columns
      const cols = this.db.prepare(`PRAGMA table_info("${tableName}")`).all() as {
        cid: number;
        name: string;
        type: string;
        notnull: number;
        dflt_value: string | number | null;
        pk: number;
      }[];

      const columns: RawColumnInfo[] = cols.map(c => ({
        columnName: c.name,
        dataType: c.type,
        isNullable: c.notnull === 0,
        isPrimaryKey: c.pk > 0,
        columnDefault: c.dflt_value ? String(c.dflt_value) : null,
      }));

      // Get foreign keys
      const fksInfo = this.db.prepare(`PRAGMA foreign_key_list("${tableName}")`).all() as {
        id: number;
        seq: number;
        table: string;
        from: string;
        to: string;
      }[];

      const foreignKeys: RawForeignKeyInfo[] = fksInfo.map(fk => ({
        constraintName: `fk_${tableName}_${fk.from}`,
        columnName: fk.from,
        referencedTable: fk.table,
        referencedColumn: fk.to,
      }));

      resultTables.push({
        tableName,
        tableSchema: 'public', // SQLite doesn't really have schemas in this way
        columns,
        foreignKeys,
      });
    }

    return { tables: resultTables };
  }

  async close(): Promise<void> {
    this.db.close();
  }
}
