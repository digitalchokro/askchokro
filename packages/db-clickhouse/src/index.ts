/**
 * @digitalchokro/db-clickhouse — ClickHouse Database Adapter
 *
 * Implements the DatabaseAdapter interface for ClickHouse analytical databases.
 * ClickHouse is a high-performance column-oriented DBMS for real-time
 * analytical reporting, event tracking, and large time-series workloads.
 */

import { createClient, type ClickHouseClient } from '@clickhouse/client';
import type {
  DatabaseAdapter,
  QueryResult,
  RawSchemaResult,
  RawTableInfo,
  RawColumnInfo,
  TenantContext,
} from '@digitalchokro/core';

export interface ClickHouseAdapterConfig {
  /** ClickHouse HTTP URL endpoint (default: 'http://localhost:8123') */
  url?: string;
  /** Username (default: 'default') */
  username?: string;
  /** Password */
  password?: string;
  /** Database name (default: 'default') */
  database?: string;
  /** Request timeout in ms (default: 30000) */
  requestTimeout?: number;
  /** Custom client instance (for testing or custom pooling) */
  client?: ClickHouseClient;
}

export class ClickHouseAdapter implements DatabaseAdapter {
  readonly dialect = 'clickhouse' as const;
  readonly name = 'clickhouse';

  private client: ClickHouseClient;
  private database: string;

  constructor(config: ClickHouseAdapterConfig = {}) {
    this.database = config.database || 'default';
    if (config.client) {
      this.client = config.client;
    } else {
      this.client = createClient({
        url: config.url || 'http://localhost:8123',
        username: config.username || 'default',
        password: config.password || '',
        database: this.database,
        request_timeout: config.requestTimeout || 30_000,
      });
    }
  }

  async execute(sql: string, params: unknown[] = [], context?: TenantContext): Promise<QueryResult> {
    const start = performance.now();
    const readOnly = context?.metadata?.readOnly === true;

    // Read-only boundary backstop
    if (readOnly) {
      const trimmed = sql.trim().toLowerCase();
      const forbidden = ['insert ', 'alter ', 'drop ', 'truncate ', 'create ', 'optimize '];
      if (forbidden.some((f) => trimmed.startsWith(f))) {
        throw new Error('read-only mode: refusing to execute a non-SELECT statement');
      }
    }

    try {
      const query_params: Record<string, unknown> = {};
      if (Array.isArray(params)) {
        params.forEach((val, idx) => {
          query_params[`p${idx + 1}`] = val;
        });
      }

      const resultSet = await this.client.query({
        query: sql,
        query_params,
        format: 'JSONEachRow',
      });

      const rows = (await resultSet.json<Record<string, unknown>>()) as Record<string, unknown>[];
      return {
        rows,
        rowCount: rows.length,
        executionMs: performance.now() - start,
      };
    } catch (err: unknown) {
      if (err instanceof Error && err.message.startsWith('read-only mode:')) {
        throw err;
      }
      throw new Error(`[AskChokro] ClickHouse execution error: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  async introspectSchema(): Promise<RawSchemaResult> {
    const tablesQuery = `
      SELECT name AS table_name, database AS table_schema
      FROM system.tables
      WHERE database = {db: String}
      ORDER BY name
    `;

    const tablesResult = await this.client.query({
      query: tablesQuery,
      query_params: { db: this.database },
      format: 'JSONEachRow',
    });

    const tables = (await tablesResult.json<{ table_name: string; table_schema: string }>()) as {
      table_name: string;
      table_schema: string;
    }[];
    const resultTables: RawTableInfo[] = [];

    for (const t of tables) {
      const columnsQuery = `
        SELECT
          name AS column_name,
          type AS data_type,
          default_expression AS column_default,
          is_in_primary_key
        FROM system.columns
        WHERE database = {db: String} AND table = {tbl: String}
        ORDER BY position
      `;

      const colsResult = await this.client.query({
        query: columnsQuery,
        query_params: { db: this.database, tbl: t.table_name },
        format: 'JSONEachRow',
      });

      const cols = (await colsResult.json<{
        column_name: string;
        data_type: string;
        column_default: string | null;
        is_in_primary_key: number | boolean;
      }>()) as {
        column_name: string;
        data_type: string;
        column_default: string | null;
        is_in_primary_key: number | boolean;
      }[];

      const columns: RawColumnInfo[] = cols.map((c) => ({
        columnName: c.column_name,
        dataType: c.data_type,
        isNullable: c.data_type.startsWith('Nullable('),
        isPrimaryKey: Boolean(c.is_in_primary_key),
        columnDefault: c.column_default || null,
      }));

      resultTables.push({
        tableName: t.table_name,
        tableSchema: t.table_schema,
        columns,
        foreignKeys: [],
      });
    }

    return { tables: resultTables };
  }

  async close(): Promise<void> {
    await this.client.close();
  }
}
