/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-return, @typescript-eslint/unbound-method, @typescript-eslint/explicit-function-return-type, @typescript-eslint/no-unnecessary-type-assertion */
/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-return, @typescript-eslint/unbound-method, @typescript-eslint/explicit-function-return-type, @typescript-eslint/no-unnecessary-type-assertion */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { MssqlAdapter } from './index.js';

// --- Mock mssql ---
// Must use vi.hoisted so variables are available when vi.mock is hoisted
const { mockQueryFn, mockCloseFn, mockRequestFn, mockConnect } = vi.hoisted(() => {
  const mockQueryFn = vi.fn();
  const mockCloseFn = vi.fn();
  const mockRequestFn = vi.fn(() => ({ query: mockQueryFn }));
  const mockConnect = vi.fn(() =>
    Promise.resolve({ connected: true, request: mockRequestFn, close: mockCloseFn })
  );
  return { mockQueryFn, mockCloseFn, mockRequestFn, mockConnect };
});

vi.mock('mssql', () => ({ default: { connect: mockConnect } }));

const CONN_STR = 'Server=localhost;Database=testdb;User Id=sa;Password=pass;';

describe('@digitalchokro/db-mssql', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Re-wire the request mock so it returns a fresh query fn each time
    mockRequestFn.mockImplementation(() => ({ query: mockQueryFn }));
    mockConnect.mockResolvedValue({
      connected: true,
      request: mockRequestFn,
      close: mockCloseFn,
    });
  });

  describe('Initialization', () => {
    it('throws if connectionString is empty', () => {
      expect(() => new MssqlAdapter({ connectionString: '' })).toThrow(
        /requires a connectionString/,
      );
    });

    it('has correct dialect and name', () => {
      const adapter = new MssqlAdapter({ connectionString: CONN_STR });
      expect(adapter.dialect).toBe('mssql');
      expect(adapter.name).toBe('mssql');
    });
  });

  describe('execute()', () => {
    it('lazy-connects and returns rows', async () => {
      mockQueryFn.mockResolvedValueOnce({
        recordset: [{ id: 1, name: 'Alice' }],
        rowsAffected: [1],
      });

      const adapter = new MssqlAdapter({ connectionString: CONN_STR });
      const res = await adapter.execute('SELECT * FROM users');

      expect(mockConnect).toHaveBeenCalledWith(CONN_STR);
      expect(mockQueryFn).toHaveBeenCalledWith('SELECT * FROM users');
      expect(res.rows).toEqual([{ id: 1, name: 'Alice' }]);
      expect(res.rowCount).toBe(1);
      expect(res.executionMs).toBeGreaterThanOrEqual(0);
    });

    it('does not reconnect on second call when already connected', async () => {
      mockQueryFn.mockResolvedValue({ recordset: [], rowsAffected: [0] });
      const adapter = new MssqlAdapter({ connectionString: CONN_STR });

      await adapter.execute('SELECT 1');
      await adapter.execute('SELECT 2');

      expect(mockConnect).toHaveBeenCalledTimes(1);
    });

    it('wraps errors with a readable message', async () => {
      mockQueryFn.mockRejectedValueOnce(new Error('Invalid column name'));
      const adapter = new MssqlAdapter({ connectionString: CONN_STR });

      await expect(adapter.execute('SELECT bad_col FROM users')).rejects.toThrow(
        /SQL Server execution error: Invalid column name/,
      );
    });
  });

  describe('introspectSchema()', () => {
    it('parses tables, columns, PKs, and FKs', async () => {
      mockQueryFn
        .mockResolvedValueOnce({ recordset: [{ table_name: 'orders', table_schema: 'dbo' }] })
        .mockResolvedValueOnce({
          recordset: [
            { table_name: 'orders', column_name: 'id', data_type: 'int', is_nullable: 'NO', column_default: null },
            { table_name: 'orders', column_name: 'user_id', data_type: 'int', is_nullable: 'YES', column_default: null },
          ],
        })
        .mockResolvedValueOnce({ recordset: [{ table_name: 'orders', column_name: 'id' }] })
        .mockResolvedValueOnce({
          recordset: [{
            table_name: 'orders', column_name: 'user_id',
            constraint_name: 'fk_orders_user',
            referenced_table: 'users', referenced_column: 'id',
          }],
        });

      const adapter = new MssqlAdapter({ connectionString: CONN_STR });
      const schema = await adapter.introspectSchema();

      expect(schema.tables).toHaveLength(1);
      const orders = schema.tables[0]!;
      expect(orders.tableName).toBe('orders');
      expect(orders.tableSchema).toBe('dbo');
      expect(orders.columns).toHaveLength(2);

      const idCol = orders.columns.find(c => c.columnName === 'id')!;
      expect(idCol.isPrimaryKey).toBe(true);
      expect(idCol.isNullable).toBe(false);

      expect(orders.foreignKeys).toHaveLength(1);
      expect(orders.foreignKeys[0]).toMatchObject({
        constraintName: 'fk_orders_user',
        columnName: 'user_id',
        referencedTable: 'users',
        referencedColumn: 'id',
      });
    });
  });

  describe('close()', () => {
    it('closes the pool after it has been used', async () => {
      mockQueryFn.mockResolvedValueOnce({ recordset: [{ n: 1 }], rowsAffected: [1] });
      const adapter = new MssqlAdapter({ connectionString: CONN_STR });

      await adapter.execute('SELECT 1 AS n');
      await adapter.close();

      expect(mockCloseFn).toHaveBeenCalledTimes(1);
    });

    it('does nothing if called before any query (pool is null)', async () => {
      const adapter = new MssqlAdapter({ connectionString: CONN_STR });
      await adapter.close();
      expect(mockCloseFn).not.toHaveBeenCalled();
    });
  });
});
