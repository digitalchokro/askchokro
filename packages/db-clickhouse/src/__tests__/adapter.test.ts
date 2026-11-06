import { describe, it, expect, vi } from 'vitest';
import { ClickHouseAdapter } from '../index.js';
import type { ClickHouseClient } from '@clickhouse/client';

describe('@digitalchokro/db-clickhouse', () => {
  describe('Initialization & Metadata', () => {
    it('sets correct dialect and name', () => {
      const adapter = new ClickHouseAdapter({ url: 'http://localhost:8123' });
      expect(adapter.dialect).toBe('clickhouse');
      expect(adapter.name).toBe('clickhouse');
    });
  });

  describe('Read-Only Boundary Guard', () => {
    it('rejects forbidden mutation queries when readOnly is true', async () => {
      const adapter = new ClickHouseAdapter({ url: 'http://localhost:8123' });
      await expect(
        adapter.execute('DROP TABLE events', [], {
          tenantId: 'test',
          metadata: { readOnly: true },
        })
      ).rejects.toThrow('read-only mode: refusing to execute a non-SELECT statement');

      await expect(
        adapter.execute('TRUNCATE TABLE logs', [], {
          tenantId: 'test',
          metadata: { readOnly: true },
        })
      ).rejects.toThrow('read-only mode: refusing to execute a non-SELECT statement');
    });
  });

  describe('Query Execution with Mock Client', () => {
    it('executes query and returns formatted rows', async () => {
      const mockRows = [
        { event_id: '1', event_name: 'login', count: 42 },
        { event_id: '2', event_name: 'click', count: 120 },
      ];

      const mockClient = {
        query: vi.fn().mockResolvedValue({
          json: vi.fn().mockResolvedValue(mockRows),
        }),
        close: vi.fn().mockResolvedValue(undefined),
      } as unknown as ClickHouseClient;

      const adapter = new ClickHouseAdapter({ client: mockClient });
      const result = await adapter.execute('SELECT event_id, event_name, count FROM events');

      expect(result.rows).toEqual(mockRows);
      expect(result.rowCount).toBe(2);
      expect(result.executionMs).toBeGreaterThanOrEqual(0);
      expect(mockClient.query).toHaveBeenCalledWith(
        expect.objectContaining({
          query: 'SELECT event_id, event_name, count FROM events',
          format: 'JSONEachRow',
        })
      );
    });

    it('maps parameters to query_params correctly', async () => {
      const mockClient = {
        query: vi.fn().mockResolvedValue({
          json: vi.fn().mockResolvedValue([]),
        }),
        close: vi.fn().mockResolvedValue(undefined),
      } as unknown as ClickHouseClient;

      const adapter = new ClickHouseAdapter({ client: mockClient });
      await adapter.execute('SELECT * FROM events WHERE count > {p1: UInt32}', [50]);

      expect(mockClient.query).toHaveBeenCalledWith(
        expect.objectContaining({
          query_params: { p1: 50 },
        })
      );
    });
  });

  describe('Schema Introspection with Mock Client', () => {
    it('introspects tables and columns', async () => {
      const mockTables = [{ table_name: 'events', table_schema: 'default' }];
      const mockColumns = [
        {
          column_name: 'event_id',
          data_type: 'String',
          column_default: null,
          is_in_primary_key: 1,
        },
        {
          column_name: 'count',
          data_type: 'UInt32',
          column_default: '0',
          is_in_primary_key: 0,
        },
      ];

      const mockClient = {
        query: vi
          .fn()
          .mockResolvedValueOnce({
            json: vi.fn().mockResolvedValue(mockTables),
          })
          .mockResolvedValueOnce({
            json: vi.fn().mockResolvedValue(mockColumns),
          }),
        close: vi.fn().mockResolvedValue(undefined),
      } as unknown as ClickHouseClient;

      const adapter = new ClickHouseAdapter({ client: mockClient });
      const schema = await adapter.introspectSchema();

      expect(schema.tables).toHaveLength(1);
      expect(schema.tables[0]?.tableName).toBe('events');
      expect(schema.tables[0]?.columns).toHaveLength(2);

      const pkCol = schema.tables[0]?.columns.find((c) => c.columnName === 'event_id');
      expect(pkCol?.isPrimaryKey).toBe(true);
    });
  });
});
