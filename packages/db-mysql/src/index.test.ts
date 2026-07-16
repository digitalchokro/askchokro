/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-return, @typescript-eslint/unbound-method, @typescript-eslint/explicit-function-return-type, @typescript-eslint/no-unnecessary-type-assertion */
/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-return, @typescript-eslint/unbound-method, @typescript-eslint/explicit-function-return-type, @typescript-eslint/no-unnecessary-type-assertion */
import { describe, it, expect, beforeEach, vi, type Mock } from 'vitest';
import { MysqlAdapter } from './index.js';
import mysql from 'mysql2/promise';

vi.mock('mysql2/promise', () => {
  const mockExecute = vi.fn();
  const mockQuery = vi.fn();
  const mockEnd = vi.fn();
  
  return {
    default: {
      createPool: vi.fn(() => ({
        execute: mockExecute,
        query: mockQuery,
        end: mockEnd
      }))
    }
  };
});

describe('@digitalchokro/db-mysql', () => {
  let adapter: MysqlAdapter;
  let mockExecute: Mock;
  let mockQuery: Mock;
  let mockEnd: Mock;

  beforeEach(() => {
    vi.clearAllMocks();
    adapter = new MysqlAdapter({ connectionString: 'mysql://user:pass@localhost:3306/testdb' });
    
    // Extract mocked methods from the instantiated pool
    const poolInstance = (mysql.createPool as Mock).mock.results[0]?.value;
    mockExecute = poolInstance.execute;
    mockQuery = poolInstance.query;
    mockEnd = poolInstance.end;
  });

  describe('Initialization', () => {
    it('throws error if connectionString is missing', () => {
      expect(() => new MysqlAdapter({ connectionString: '' })).toThrow(/requires a connectionString/);
    });

    it('initializes Pool with correct config', () => {
      expect(mysql.createPool).toHaveBeenCalledWith({
        uri: 'mysql://user:pass@localhost:3306/testdb',
        waitForConnections: true,
        connectionLimit: 10,
        queueLimit: 0,
      });
    });
  });

  describe('Query Execution', () => {
    it('executes SELECT queries and returns rows', async () => {
      mockExecute.mockResolvedValueOnce([[{ id: 1, name: 'Alice' }], []]);

      const res = await adapter.execute('SELECT * FROM users');
      
      expect(mockExecute).toHaveBeenCalledWith('SELECT * FROM users', []);
      expect(res.rows).toEqual([{ id: 1, name: 'Alice' }]);
      expect(res.rowCount).toBe(1);
      expect(res.executionMs).toBeGreaterThanOrEqual(0);
    });

    it('passes parameters to query', async () => {
      mockExecute.mockResolvedValueOnce([[], []]);
      await adapter.execute('SELECT * FROM users WHERE id = ?', [1]);
      expect(mockExecute).toHaveBeenCalledWith('SELECT * FROM users WHERE id = ?', [1]);
    });

    it('wraps execution errors', async () => {
      mockExecute.mockRejectedValueOnce(new Error('Syntax error'));
      await expect(adapter.execute('BAD SQL')).rejects.toThrow(/MySQL execution error: Syntax error/);
    });
  });

  describe('Schema Reading', () => {
    it('parses schema from information_schema', async () => {
      mockQuery
        // 1. Tables query
        .mockResolvedValueOnce([[{ table_name: 'users', table_schema: 'testdb' }]])
        // 2. Columns query
        .mockResolvedValueOnce([[{ table_name: 'users', column_name: 'id', data_type: 'int', is_nullable: 'NO', column_default: null },
                                { table_name: 'users', column_name: 'name', data_type: 'varchar', is_nullable: 'YES', column_default: null }]])
        // 3. Primary keys query
        .mockResolvedValueOnce([[{ table_name: 'users', column_name: 'id' }]])
        // 4. Foreign keys query
        .mockResolvedValueOnce([[]]);

      const schema = await adapter.introspectSchema();

      expect(mockQuery).toHaveBeenCalledTimes(4);
      expect(schema.tables).toHaveLength(1);
      
      const usersTable = schema.tables[0]!;
      expect(usersTable.tableName).toBe('users');
      expect(usersTable.tableSchema).toBe('testdb');
      expect(usersTable.columns).toHaveLength(2);

      const idCol = usersTable.columns.find(c => c.columnName === 'id')!;
      expect(idCol.isPrimaryKey).toBe(true);
      expect(idCol.isNullable).toBe(false);
      expect(idCol.dataType).toBe('int');

      const nameCol = usersTable.columns.find(c => c.columnName === 'name')!;
      expect(nameCol.isPrimaryKey).toBe(false);
      expect(nameCol.isNullable).toBe(true);
      expect(nameCol.dataType).toBe('varchar');

      expect(usersTable.foreignKeys).toEqual([]);
    });

    it('parses foreign keys correctly', async () => {
      mockQuery
        .mockResolvedValueOnce([[{ table_name: 'posts', table_schema: 'testdb' }]]) // tables
        .mockResolvedValueOnce([[]]) // columns
        .mockResolvedValueOnce([[]]) // PKs
        .mockResolvedValueOnce([[{ // FKs
          table_name: 'posts',
          column_name: 'user_id',
          constraint_name: 'fk_posts_user',
          referenced_table: 'users',
          referenced_column: 'id'
        }]]);

      const schema = await adapter.introspectSchema();
      const postsTable = schema.tables[0]!;
      
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
