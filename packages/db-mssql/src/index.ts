/**
 * @digitalchokro/db-mssql — Microsoft SQL Server Database Adapter
 *
 * Implements the DatabaseAdapter interface for SQL Server using the `mssql` driver.
 * Uses a connection pool for efficient connection management.
 */

import type {
  DatabaseAdapter,
  QueryResult,
  RawSchemaResult,
  RawTableInfo,
  RawColumnInfo,
  RawForeignKeyInfo,
} from '@digitalchokro/core';
import mssql from 'mssql';

export interface MssqlAdapterConfig {
  /**
   * Connection string in MSSQL format:
   * Server=myServerAddress;Database=myDataBase;User Id=myUsername;Password=myPassword;
   * Or a configuration object.
   */
  connectionString: string;
  /** Optional query timeout in milliseconds. Default: 30_000. */
  queryTimeoutMs?: number;
}

export class MssqlAdapter implements DatabaseAdapter {
  readonly dialect = 'mssql' as const;
  readonly name = 'mssql';

  private config: MssqlAdapterConfig;
  private pool: mssql.ConnectionPool | null = null;

  constructor(config: MssqlAdapterConfig) {
    if (!config.connectionString) {
      throw new Error(
        '[AskChokro] MssqlAdapter requires a connectionString. ' +
        'Example: new MssqlAdapter({ connectionString: "Server=...;Database=...;User Id=...;Password=...;" })',
      );
    }
    this.config = config;
  }

  private async getPool(): Promise<mssql.ConnectionPool> {
    if (!this.pool || !this.pool.connected) {
      this.pool = await mssql.connect(this.config.connectionString);
    }
    return this.pool;
  }

  async execute(sql: string, _params: unknown[] = [], _context?: import('@digitalchokro/core').TenantContext): Promise<QueryResult> {
    const start = performance.now();
    try {
      const pool = await this.getPool();
      const request = pool.request();

      // SQL Server uses positional @p1, @p2 params, but the agent generates raw SQL
      // For now we execute directly — parameterization is future work for mssql dialects.
      const result = await request.query(sql);
      const executionMs = performance.now() - start;

      return {
        rows: result.recordset as Record<string, unknown>[],
        rowCount: result.rowsAffected[0] ?? result.recordset.length,
        executionMs,
      };
    } catch (e) {
      throw new Error(`[AskChokro] SQL Server execution error: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  async introspectSchema(): Promise<RawSchemaResult> {
    const pool = await this.getPool();

    const tablesQuery = `
      SELECT TABLE_NAME AS table_name, TABLE_SCHEMA AS table_schema
      FROM INFORMATION_SCHEMA.TABLES
      WHERE TABLE_TYPE = 'BASE TABLE';
    `;
    const columnsQuery = `
      SELECT TABLE_NAME AS table_name, COLUMN_NAME AS column_name,
             DATA_TYPE AS data_type, IS_NULLABLE AS is_nullable,
             COLUMN_DEFAULT AS column_default
      FROM INFORMATION_SCHEMA.COLUMNS;
    `;
    const pksQuery = `
      SELECT kcu.TABLE_NAME AS table_name, kcu.COLUMN_NAME AS column_name
      FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS AS tc
      JOIN INFORMATION_SCHEMA.KEY_COLUMN_USAGE AS kcu
        ON kcu.CONSTRAINT_NAME = tc.CONSTRAINT_NAME
      WHERE tc.CONSTRAINT_TYPE = 'PRIMARY KEY';
    `;
    const fksQuery = `
      SELECT
        fkc.TABLE_NAME AS table_name,
        fkc.COLUMN_NAME AS column_name,
        fk.CONSTRAINT_NAME AS constraint_name,
        pkt.TABLE_NAME AS referenced_table,
        pkc.COLUMN_NAME AS referenced_column
      FROM INFORMATION_SCHEMA.REFERENTIAL_CONSTRAINTS AS rc
      JOIN INFORMATION_SCHEMA.KEY_COLUMN_USAGE AS fkc
        ON fkc.CONSTRAINT_NAME = rc.CONSTRAINT_NAME
      JOIN INFORMATION_SCHEMA.TABLE_CONSTRAINTS AS fk
        ON fk.CONSTRAINT_NAME = rc.CONSTRAINT_NAME
      JOIN INFORMATION_SCHEMA.TABLE_CONSTRAINTS AS pkt
        ON pkt.CONSTRAINT_NAME = rc.UNIQUE_CONSTRAINT_NAME
      JOIN INFORMATION_SCHEMA.KEY_COLUMN_USAGE AS pkc
        ON pkc.CONSTRAINT_NAME = rc.UNIQUE_CONSTRAINT_NAME
        AND pkc.ORDINAL_POSITION = fkc.ORDINAL_POSITION;
    `;

    const [tablesRes, columnsRes, pksRes, fksRes] = await Promise.all([
      pool.request().query(tablesQuery),
      pool.request().query(columnsQuery),
      pool.request().query(pksQuery),
      pool.request().query(fksQuery),
    ]);

    const tablesRows = tablesRes.recordset as Record<string, unknown>[];
    const columnsRows = columnsRes.recordset as Record<string, unknown>[];
    const pksRows = pksRes.recordset as Record<string, unknown>[];
    const fksRows = fksRes.recordset as Record<string, unknown>[];

    const resultTables: RawTableInfo[] = tablesRows.map(t => {
      const tName = String(t.table_name);
      const tSchema = String(t.table_schema);

      const cols = columnsRows.filter(c => String(c.table_name) === tName);
      const pks = pksRows
        .filter(p => String(p.table_name) === tName)
        .map(p => String(p.column_name));

      const columns: RawColumnInfo[] = cols.map(c => ({
        columnName: String(c.column_name),
        dataType: String(c.data_type),
        isNullable: c.is_nullable === 'YES',
        // eslint-disable-next-line @typescript-eslint/no-base-to-string
        columnDefault: c.column_default != null ? String(c.column_default) : null,
        isPrimaryKey: pks.includes(String(c.column_name)),
      }));

      const fks = fksRows.filter(fk => String(fk.table_name) === tName);
      const foreignKeys: RawForeignKeyInfo[] = fks.map(fk => ({
        constraintName: String(fk.constraint_name),
        columnName: String(fk.column_name),
        referencedTable: String(fk.referenced_table),
        referencedColumn: String(fk.referenced_column),
      }));

      return { tableName: tName, tableSchema: tSchema, columns, foreignKeys };
    });

    return { tables: resultTables };
  }

  async close(): Promise<void> {
    if (this.pool) {
      await this.pool.close();
      this.pool = null;
    }
  }
}
