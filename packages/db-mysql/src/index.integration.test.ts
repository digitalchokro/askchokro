/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-return, @typescript-eslint/unbound-method, @typescript-eslint/explicit-function-return-type, @typescript-eslint/no-unnecessary-type-assertion */
/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-return, @typescript-eslint/unbound-method, @typescript-eslint/explicit-function-return-type, @typescript-eslint/no-unnecessary-type-assertion */
/**
 * MySQL Integration Tests — requires a running MySQL instance.
 *
 * Usage:
 *   1. Run the test DB: docker compose -f docker-compose.test.yml up -d
 *   2. Run: MYSQL_INTEGRATION=true pnpm test:integration
 *   3. Tear down: docker compose -f docker-compose.test.yml down
 *
 * In CI these are run via the 'integration-mysql' job that spins up a mysql service container.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { MysqlAdapter } from './index.js';

const MYSQL_URL = process.env.MYSQL_TEST_URL ?? 'mysql://testuser:testpassword@localhost:3307/testdb';
const SKIP = !process.env.MYSQL_INTEGRATION && !process.env.CI;

describe.skipIf(SKIP)('@digitalchokro/db-mysql integration', () => {
  let adapter: MysqlAdapter;

  beforeAll(() => {
    adapter = new MysqlAdapter({ connectionString: MYSQL_URL });
  });

  afterAll(async () => {
    await adapter.close();
  });

  it('executes a basic SELECT', async () => {
    const result = await adapter.execute('SELECT 1 AS value');
    expect(result.rows).toEqual([{ value: 1 }]);
    expect(result.rowCount).toBe(1);
    expect(result.executionMs).toBeGreaterThanOrEqual(0);
  });

  it('reads seeded users table', async () => {
    const result = await adapter.execute('SELECT * FROM users ORDER BY id');
    expect(result.rows).toHaveLength(2);
    expect(result.rows[0]).toMatchObject({ name: 'Alice', email: 'alice@example.com' });
    expect(result.rows[1]).toMatchObject({ name: 'Bob',   email: 'bob@example.com' });
  });

  it('returns correct rowCount for multi-row query', async () => {
    const result = await adapter.execute('SELECT * FROM posts');
    expect(result.rowCount).toBe(3);
    expect(result.rows).toHaveLength(3);
  });

  it('executes a parameterized query', async () => {
    const result = await adapter.execute('SELECT name FROM users WHERE id = ?', [1]);
    expect(result.rows).toEqual([{ name: 'Alice' }]);
  });

  it('throws on invalid SQL', async () => {
    await expect(adapter.execute('NOT VALID SQL !!!'))
      .rejects.toThrow(/MySQL execution error/);
  });

  it('introspects schema — tables', async () => {
    const schema = await adapter.introspectSchema();
    const tableNames = schema.tables.map(t => t.tableName);
    expect(tableNames).toContain('users');
    expect(tableNames).toContain('posts');
  });

  it('introspects schema — columns of users', async () => {
    const schema = await adapter.introspectSchema();
    const usersTable = schema.tables.find(t => t.tableName === 'users')!;
    expect(usersTable).toBeDefined();

    const colNames = usersTable.columns.map(c => c.columnName);
    expect(colNames).toContain('id');
    expect(colNames).toContain('name');
    expect(colNames).toContain('email');

    const idCol = usersTable.columns.find(c => c.columnName === 'id')!;
    expect(idCol.isPrimaryKey).toBe(true);
    expect(idCol.isNullable).toBe(false);
  });

  it('introspects schema — foreign keys of posts', async () => {
    const schema = await adapter.introspectSchema();
    const postsTable = schema.tables.find(t => t.tableName === 'posts')!;
    expect(postsTable.foreignKeys).toHaveLength(1);
    expect(postsTable.foreignKeys[0]).toMatchObject({
      constraintName: 'fk_posts_user',
      columnName: 'user_id',
      referencedTable: 'users',
      referencedColumn: 'id',
    });
  });

  it('handles empty result sets gracefully', async () => {
    const result = await adapter.execute('SELECT * FROM users WHERE id = 99999');
    expect(result.rows).toEqual([]);
    expect(result.rowCount).toBe(0);
  });
});
