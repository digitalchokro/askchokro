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

  async execute(sql: string, params: unknown[] = []): Promise<QueryResult> {
    const start = performance.now();
    try {
      const [rows, fields] = await this.pool.execute(sql, params as any[]);
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

    const tablesRows = tablesRes[0] as { TABLE_NAME: string; TABLE_SCHEMA: string }[];
    const columnsRows = columnsRes[0] as { TABLE_NAME: string; COLUMN_NAME: string; DATA_TYPE: string; IS_NULLABLE: string; COLUMN_DEFAULT: string | null }[];
    const pksRows = pksRes[0] as { TABLE_NAME: string; COLUMN_NAME: string }[];
    const fksRows = fksRes[0] as { TABLE_NAME: string; COLUMN_NAME: string; CONSTRAINT_NAME: string; referenced_table: string; referenced_column: string }[];

    const resultTables: RawTableInfo[] = tablesRows.map(t => {
      const tName = t.TABLE_NAME || (t as any).table_name;
      const tSchema = t.TABLE_SCHEMA || (t as any).table_schema;

      const cols = columnsRows.filter(c => (c.TABLE_NAME || (c as any).table_name) === tName);
      const pks = pksRows.filter(p => (p.TABLE_NAME || (p as any).table_name) === tName).map(p => (p.COLUMN_NAME || (p as any).column_name));
      
      const columns: RawColumnInfo[] = cols.map(c => ({
        columnName: c.COLUMN_NAME || (c as any).column_name,
        dataType: c.DATA_TYPE || (c as any).data_type,
        isNullable: (c.IS_NULLABLE || (c as any).is_nullable) === 'YES',
        columnDefault: c.COLUMN_DEFAULT !== undefined ? c.COLUMN_DEFAULT : (c as any).column_default,
        isPrimaryKey: pks.includes(c.COLUMN_NAME || (c as any).column_name),
      }));

      const fks = fksRows.filter(fk => (fk.TABLE_NAME || (fk as any).table_name) === tName);
      const foreignKeys: RawForeignKeyInfo[] = fks.map(fk => ({
        constraintName: fk.CONSTRAINT_NAME || (fk as any).constraint_name,
        columnName: fk.COLUMN_NAME || (fk as any).column_name,
        referencedTable: fk.referenced_table,
        referencedColumn: fk.referenced_column,
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
