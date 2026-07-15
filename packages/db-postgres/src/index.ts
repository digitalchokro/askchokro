/**
 * @digitalchokro/db-postgres — PostgreSQL Database Adapter
 *
 * Implements the DatabaseAdapter interface for PostgreSQL using the `pg` driver.
 */

import type {
  DatabaseAdapter,
  QueryResult,
  RawSchemaResult,
  RawTableInfo,
  RawColumnInfo,
  RawForeignKeyInfo,
} from '@digitalchokro/core';
import { Pool } from 'pg';

export interface PostgresAdapterConfig {
  /** PostgreSQL connection string (e.g., postgresql://user:pass@localhost:5432/dbname). */
  connectionString: string;
  /** Query timeout in milliseconds. Default: 10_000. */
  queryTimeoutMs?: number;
}

export class PostgresAdapter implements DatabaseAdapter {
  readonly dialect = 'postgres' as const;
  readonly name = 'postgres';

  private config: PostgresAdapterConfig;
  private pool: Pool;

  constructor(config: PostgresAdapterConfig) {
    if (!config.connectionString) {
      throw new Error(
        '[AskChokro] PostgresAdapter requires a connectionString. ' +
        'Example: new PostgresAdapter({ connectionString: "postgresql://..." })',
      );
    }
    this.config = config;
    this.pool = new Pool({
      connectionString: config.connectionString,
      statement_timeout: config.queryTimeoutMs ?? 10_000,
      query_timeout: config.queryTimeoutMs ?? 10_000,
    });
  }

  async execute(sql: string, params: unknown[] = [], context?: import('@digitalchokro/core').TenantContext): Promise<QueryResult> {
    const start = performance.now();
    let client;
    try {
      const rlsConfig = context?.metadata?.rls as { enabled: boolean; setSessionVariable?: boolean; sessionVariableKey?: string } | undefined;
      const tenantId = context?.tenantId;

      if (rlsConfig?.enabled && rlsConfig.setSessionVariable && tenantId) {
        client = await this.pool.connect();
        await client.query('BEGIN');
        const sessionKey = rlsConfig.sessionVariableKey ?? 'app.current_tenant';
        await client.query(`SELECT set_config($1, $2, true)`, [sessionKey, String(tenantId)]);
        const result = await client.query(sql, params);
        await client.query('COMMIT');
        
        const executionMs = performance.now() - start;
        return {
          rows: result.rows as Record<string, unknown>[],
          rowCount: result.rowCount ?? 0,
          executionMs,
        };
      } else {
        const result = await this.pool.query(sql, params);
        const executionMs = performance.now() - start;
        return {
          rows: result.rows as Record<string, unknown>[],
          rowCount: result.rowCount ?? 0,
          executionMs,
        };
      }
    } catch (e) {
      if (client) {
        try { await client.query('ROLLBACK'); } catch (err) {}
      }
      throw new Error(`[AskChokro] Postgres execution error: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      if (client) {
        client.release();
      }
    }
  }

  async introspectSchema(): Promise<RawSchemaResult> {
    // Basic introspection queries
    const tablesQuery = `
      SELECT table_name, table_schema
      FROM information_schema.tables
      WHERE table_schema = 'public' AND table_type = 'BASE TABLE';
    `;
    const columnsQuery = `
      SELECT table_name, column_name, data_type, is_nullable, column_default
      FROM information_schema.columns
      WHERE table_schema = 'public';
    `;
    const pksQuery = `
      SELECT kcu.table_name, kcu.column_name
      FROM information_schema.table_constraints tco
      JOIN information_schema.key_column_usage kcu
        ON kcu.constraint_name = tco.constraint_name
      WHERE tco.constraint_type = 'PRIMARY KEY' AND kcu.table_schema = 'public';
    `;
    const fksQuery = `
      SELECT
        tc.table_name, kcu.column_name,
        tc.constraint_name,
        ccu.table_name AS referenced_table,
        ccu.column_name AS referenced_column
      FROM information_schema.table_constraints AS tc
      JOIN information_schema.key_column_usage AS kcu
        ON tc.constraint_name = kcu.constraint_name
      JOIN information_schema.constraint_column_usage AS ccu
        ON ccu.constraint_name = tc.constraint_name
      WHERE tc.constraint_type = 'FOREIGN KEY' AND tc.table_schema = 'public';
    `;

    const [tablesRes, columnsRes, pksRes, fksRes] = await Promise.all([
      this.pool.query(tablesQuery),
      this.pool.query(columnsQuery),
      this.pool.query(pksQuery),
      this.pool.query(fksQuery),
    ]);

    const tablesRows = tablesRes.rows as { table_name: string; table_schema: string }[];
    const columnsRows = columnsRes.rows as { table_name: string; column_name: string; data_type: string; is_nullable: string; column_default: string | null }[];
    const pksRows = pksRes.rows as { table_name: string; column_name: string }[];
    const fksRows = fksRes.rows as { table_name: string; column_name: string; constraint_name: string; referenced_table: string; referenced_column: string }[];

    const resultTables: RawTableInfo[] = tablesRows.map(t => {
      const tName = t.table_name;
      const tSchema = t.table_schema;

      const cols = columnsRows.filter(c => c.table_name === tName);
      const pks = pksRows.filter(p => p.table_name === tName).map(p => p.column_name);
      
      const columns: RawColumnInfo[] = cols.map(c => ({
        columnName: c.column_name,
        dataType: c.data_type,
        isNullable: c.is_nullable === 'YES',
        columnDefault: c.column_default,
        isPrimaryKey: pks.includes(c.column_name),
      }));

      const fks = fksRows.filter(fk => fk.table_name === tName);
      const foreignKeys: RawForeignKeyInfo[] = fks.map(fk => ({
        constraintName: fk.constraint_name,
        columnName: fk.column_name,
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
