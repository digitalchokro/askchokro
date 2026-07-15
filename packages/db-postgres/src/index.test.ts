import { describe, it, expect, beforeEach, vi, type Mock } from 'vitest';
import { PostgresAdapter } from './index.js';
import { Pool } from 'pg';

// Mock pg module
vi.mock('pg', () => {
  const mockQuery = vi.fn();
  const mockEnd = vi.fn();
  return {
    Pool: vi.fn(function MockPool() {
      return {
        query: mockQuery,
        end: mockEnd
      };
    })
  };
});

describe('@digitalchokro/db-postgres', () => {
  let adapter: PostgresAdapter;
  let mockQuery: Mock;
  let mockEnd: Mock;

  beforeEach(() => {
    vi.clearAllMocks();
    adapter = new PostgresAdapter({ connectionString: 'postgresql://user:pass@localhost:5432/testdb' });
    
    // Extract mocked methods from the instantiated pool
    const poolInstance = (Pool as unknown as Mock).mock.results[0].value;
    mockQuery = poolInstance.query;
    mockEnd = poolInstance.end;
  });

  describe('Initialization', () => {
    it('throws error if connectionString is missing', () => {
      expect(() => new PostgresAdapter({ connectionString: '' })).toThrow(/requires a connectionString/);
    });

    it('initializes Pool with default timeout', () => {
      expect(Pool).toHaveBeenCalledWith({
        connectionString: 'postgresql://user:pass@localhost:5432/testdb',
        statement_timeout: 10000,
        query_timeout: 10000,
      });
    });

    it('respects custom timeout', () => {
      new PostgresAdapter({ connectionString: 'postgresql://user:pass@localhost:5432/testdb', queryTimeoutMs: 5000 });
      expect(Pool).toHaveBeenCalledWith({
        connectionString: 'postgresql://user:pass@localhost:5432/testdb',
        statement_timeout: 5000,
        query_timeout: 5000,
      });
    });
  });

  describe('Query Execution', () => {
    it('executes SELECT queries and returns rows', async () => {
      mockQuery.mockResolvedValueOnce({
        rows: [{ id: 1, name: 'Alice' }],
        rowCount: 1,
      });

      const res = await adapter.execute('SELECT * FROM users');
      
      expect(mockQuery).toHaveBeenCalledWith('SELECT * FROM users', []);
      expect(res.rows).toEqual([{ id: 1, name: 'Alice' }]);
      expect(res.rowCount).toBe(1);
      expect(res.executionMs).toBeGreaterThanOrEqual(0);
    });

    it('passes parameters to query', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 });
      await adapter.execute('SELECT * FROM users WHERE id = $1', [1]);
      expect(mockQuery).toHaveBeenCalledWith('SELECT * FROM users WHERE id = $1', [1]);
    });

    it('wraps execution errors', async () => {
      mockQuery.mockRejectedValueOnce(new Error('Syntax error'));
      await expect(adapter.execute('BAD SQL')).rejects.toThrow(/Postgres execution error: Syntax error/);
    });
  });

  describe('Schema Reading', () => {
    it('parses schema from information_schema', async () => {
      mockQuery
        // 1. Tables query
        .mockResolvedValueOnce({
          rows: [{ table_name: 'users', table_schema: 'public' }]
        })
        // 2. Columns query
        .mockResolvedValueOnce({
          rows: [
            { table_name: 'users', column_name: 'id', data_type: 'integer', is_nullable: 'NO', column_default: null },
            { table_name: 'users', column_name: 'name', data_type: 'text', is_nullable: 'YES', column_default: null }
          ]
        })
        // 3. Primary keys query
        .mockResolvedValueOnce({
          rows: [{ table_name: 'users', column_name: 'id' }]
        })
        // 4. Foreign keys query
        .mockResolvedValueOnce({
          rows: []
        });

      const schema = await adapter.introspectSchema();

      expect(mockQuery).toHaveBeenCalledTimes(4);
      expect(schema.tables).toHaveLength(1);
      
      const usersTable = schema.tables[0];
      expect(usersTable.tableName).toBe('users');
      expect(usersTable.tableSchema).toBe('public');
      expect(usersTable.columns).toHaveLength(2);

      const idCol = usersTable.columns.find(c => c.columnName === 'id')!;
      expect(idCol.isPrimaryKey).toBe(true);
      expect(idCol.isNullable).toBe(false);
      expect(idCol.dataType).toBe('integer');

      const nameCol = usersTable.columns.find(c => c.columnName === 'name')!;
      expect(nameCol.isPrimaryKey).toBe(false);
      expect(nameCol.isNullable).toBe(true);
      expect(nameCol.dataType).toBe('text');

      expect(usersTable.foreignKeys).toEqual([]);
    });

    it('parses foreign keys correctly', async () => {
      mockQuery
        .mockResolvedValueOnce({ rows: [{ table_name: 'posts', table_schema: 'public' }] }) // tables
        .mockResolvedValueOnce({ rows: [] }) // columns
        .mockResolvedValueOnce({ rows: [] }) // PKs
        .mockResolvedValueOnce({ // FKs
          rows: [{
            table_name: 'posts',
            column_name: 'user_id',
            constraint_name: 'fk_posts_user',
            referenced_table: 'users',
            referenced_column: 'id'
          }]
        });

      const schema = await adapter.introspectSchema();
      const postsTable = schema.tables[0];
      
      expect(postsTable.foreignKeys).toHaveLength(1);
      expect(postsTable.foreignKeys[0]).toEqual({
        constraintName: 'fk_posts_user',
        columnName: 'user_id',
        referencedTable: 'users',
        referencedColumn: 'id',
      });
    });
  });

  describe('Closing', () => {
    it('ends the pool', async () => {
      await adapter.close();
      expect(mockEnd).toHaveBeenCalled();
    });
  });
});
