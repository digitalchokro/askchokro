/**
 * @digitalchokro/db-mysql — MySQL/MariaDB Database Adapter
 *
 * Implements the DatabaseAdapter interface for MySQL using the `mysql2` driver.
 */

import type {
  DatabaseAdapter,
  QueryResult,
  RawSchemaResult,
  RawTableInfo,
  RawColumnInfo,
  RawForeignKeyInfo,
} from '@digitalchokro/core';
import mysql from 'mysql2/promise';

export interface MysqlAdapterConfig {
  /** MySQL connection string (e.g., mysql://user:pass@localhost:3306/dbname). */
  connectionString: string;
}

export class MysqlAdapter implements DatabaseAdapter {
  readonly dialect = 'mysql' as const;
  readonly name = 'mysql';

  private config: MysqlAdapterConfig;
  private pool: mysql.Pool;

  constructor(config: MysqlAdapterConfig) {
    if (!config.connectionString) {
      throw new Error(
        '[AskChokro] MysqlAdapter requires a connectionString. ' +
        'Example: new MysqlAdapter({ connectionString: "mysql://..." })',
      );
    }
    this.config = config;
    this.pool = mysql.createPool({
      uri: config.connectionString,
      waitForConnections: true,
      connectionLimit: 10,
      queueLimit: 0,
    });
  }

  async execute(sql: string, params: unknown[] = [], _context?: import('@digitalchokro/core').TenantContext): Promise<QueryResult> {
    const start = performance.now();
    try {
      const [rows] = await this.pool.execute(sql, params as (string | number | boolean | null)[]);
      const executionMs = performance.now() - start;
      return {
        rows: rows as Record<string, unknown>[],
        rowCount: Array.isArray(rows) ? rows.length : 0,
        executionMs,
      };
    } catch (e) {
      throw new Error(`[AskChokro] MySQL execution error: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  async introspectSchema(): Promise<RawSchemaResult> {
    // Basic introspection queries for MySQL
    const tablesQuery = `
      SELECT table_name, table_schema
      FROM information_schema.tables
      WHERE table_schema = DATABASE() AND table_type = 'BASE TABLE';
    `;
    const columnsQuery = `
      SELECT table_name, column_name, data_type, is_nullable, column_default
      FROM information_schema.columns
      WHERE table_schema = DATABASE();
    `;
    const pksQuery = `
      SELECT kcu.table_name, kcu.column_name
      FROM information_schema.table_constraints tco
      JOIN information_schema.key_column_usage kcu
        ON kcu.constraint_name = tco.constraint_name
      WHERE tco.constraint_type = 'PRIMARY KEY' AND kcu.table_schema = DATABASE();
    `;
    const fksQuery = `
      SELECT
        tc.table_name, kcu.column_name,
        tc.constraint_name,
        kcu.referenced_table_name AS referenced_table,
        kcu.referenced_column_name AS referenced_column
      FROM information_schema.table_constraints AS tc
      JOIN information_schema.key_column_usage AS kcu
        ON tc.constraint_name = kcu.constraint_name
      WHERE tc.constraint_type = 'FOREIGN KEY' AND tc.table_schema = DATABASE();
    `;

    const [tablesRes, columnsRes, pksRes, fksRes] = await Promise.all([
      this.pool.query(tablesQuery),
      this.pool.query(columnsQuery),
      this.pool.query(pksQuery),
      this.pool.query(fksQuery),
    ]);

    const tablesRows = tablesRes[0] as Record<string, unknown>[];
    const columnsRows = columnsRes[0] as Record<string, unknown>[];
    const pksRows = pksRes[0] as Record<string, unknown>[];
    const fksRows = fksRes[0] as Record<string, unknown>[];

    const resultTables: RawTableInfo[] = tablesRows.map(t => {
      const tName = String(t.TABLE_NAME || t.table_name);
      const tSchema = String(t.TABLE_SCHEMA || t.table_schema);

      const cols = columnsRows.filter(c => String(c.TABLE_NAME || c.table_name) === tName);
      const pks = pksRows.filter(p => String(p.TABLE_NAME || p.table_name) === tName).map(p => String(p.COLUMN_NAME || p.column_name));
      
      const columns: RawColumnInfo[] = cols.map(c => ({
        columnName: String(c.COLUMN_NAME || c.column_name),
        dataType: String(c.DATA_TYPE || c.data_type),
        isNullable: (c.IS_NULLABLE || c.is_nullable) === 'YES',
        columnDefault: c.COLUMN_DEFAULT !== undefined ? String(c.COLUMN_DEFAULT as string | number | boolean) : (c.column_default !== undefined ? String(c.column_default as string | number | boolean) : null),
        isPrimaryKey: pks.includes(String(c.COLUMN_NAME || c.column_name)),
      }));

      const fks = fksRows.filter(fk => String(fk.TABLE_NAME || fk.table_name) === tName);
      const foreignKeys: RawForeignKeyInfo[] = fks.map(fk => ({
        constraintName: String(fk.CONSTRAINT_NAME || fk.constraint_name),
        columnName: String(fk.COLUMN_NAME || fk.column_name),
        referencedTable: String(fk.referenced_table),
        referencedColumn: String(fk.referenced_column),
      }));

      return {
        tableName: tName,
        tableSchema: tSchema,
        columns,
        foreignKeys,
      };
    });

    return { tables: resultTables };
  }

  async close(): Promise<void> {
    await this.pool.end();
  }
}
