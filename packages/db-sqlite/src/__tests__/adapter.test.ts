import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import path from 'path';
import fs from 'fs';
import os from 'os';
import { SQLiteAdapter } from '../index.js';
import Database from 'better-sqlite3';

describe('@digitalchokro/db-sqlite', () => {
  let testDbPath: string;

  beforeEach(() => {
    testDbPath = path.join(os.tmpdir(), `test-${Date.now()}-${Math.random()}.db`);
  });

  afterEach(() => {
    if (fs.existsSync(testDbPath)) {
      fs.unlinkSync(testDbPath);
    }
  });

  describe('SqliteAdapter Initialization', () => {
    it('creates database file at specified path', async () => {
      const adapter = new SQLiteAdapter({ path: testDbPath });
      await adapter.execute('CREATE TABLE init_test (id INTEGER)');
      expect(fs.existsSync(testDbPath)).toBe(true);
      await adapter.close();
    });

    it('initializes in-memory database when path is ":memory:"', async () => {
      const adapter = new SQLiteAdapter({ path: ':memory:' });
      await adapter.execute('CREATE TABLE mem_test (id INTEGER)');
      expect(fs.existsSync(':memory:')).toBe(false);
      await adapter.close();
    });

    it('opens existing database files', async () => {
      // Setup
      const db = new Database(testDbPath);
      db.exec('CREATE TABLE existing_test (id INTEGER)');
      db.close();

      // Test
      const adapter = new SQLiteAdapter({ path: testDbPath });
      const schema = await adapter.introspectSchema();
      expect(schema.tables.some(t => t.tableName === 'existing_test')).toBe(true);
      await adapter.close();
    });
  });

  describe('Schema Reading', () => {
    it('reads table list and column information', async () => {
      const adapter = new SQLiteAdapter({ path: ':memory:' });
      await adapter.execute("CREATE TABLE users (id INTEGER PRIMARY KEY, name TEXT NOT NULL, email TEXT DEFAULT 'none')");
      
      const schema = await adapter.introspectSchema();
      expect(schema.tables).toHaveLength(1);
      
      const table = schema.tables[0]!;
      expect(table.tableName).toBe('users');
      expect(table.columns).toHaveLength(3);
      
      const idCol = table.columns.find(c => c.columnName === 'id')!;
      expect(idCol.isPrimaryKey).toBe(true);
      expect(idCol.dataType).toBe('INTEGER');

      const nameCol = table.columns.find(c => c.columnName === 'name')!;
      expect(nameCol.isNullable).toBe(false);
      expect(nameCol.dataType).toBe('TEXT');

      const emailCol = table.columns.find(c => c.columnName === 'email')!;
      expect(emailCol.columnDefault).toBe("'none'");

      await adapter.close();
    });

    it('detects foreign keys', async () => {
      const adapter = new SQLiteAdapter({ path: ':memory:' });
      await adapter.execute('CREATE TABLE users (id INTEGER PRIMARY KEY)');
      await adapter.execute('CREATE TABLE posts (id INTEGER PRIMARY KEY, user_id INTEGER, FOREIGN KEY(user_id) REFERENCES users(id))');
      
      const schema = await adapter.introspectSchema();
      const postsTable = schema.tables.find(t => t.tableName === 'posts')!;
      expect(postsTable.foreignKeys).toHaveLength(1);
      expect(postsTable.foreignKeys[0]!.referencedTable).toBe('users');
      expect(postsTable.foreignKeys[0]!.referencedColumn).toBe('id');
      expect(postsTable.foreignKeys[0]!.columnName).toBe('user_id');

      await adapter.close();
    });

    it('handles databases with no tables', async () => {
      const adapter = new SQLiteAdapter({ path: ':memory:' });
      const schema = await adapter.introspectSchema();
      expect(schema.tables).toHaveLength(0);
      await adapter.close();
    });
  });

  describe('Query Execution', () => {
    let adapter: SQLiteAdapter;

    beforeEach(async () => {
      adapter = new SQLiteAdapter({ path: ':memory:' });
      await adapter.execute('CREATE TABLE users (id INTEGER, name TEXT)');
      await adapter.execute("INSERT INTO users VALUES (1, 'Alice'), (2, 'Bob')");
    });

    afterEach(async () => {
      await adapter.close();
    });

    it('executes SELECT statements', async () => {
      const res = await adapter.execute('SELECT * FROM users');
      expect(res.rowCount).toBe(2);
      expect(res.rows).toEqual([
        { id: 1, name: 'Alice' },
        { id: 2, name: 'Bob' }
      ]);
    });

    it('executes UPDATE statements', async () => {
      const res = await adapter.execute("UPDATE users SET name = 'Alice2' WHERE id = 1");
      expect(res.rowCount).toBe(1); // 1 row changed
      
      const verify = await adapter.execute('SELECT name FROM users WHERE id = 1');
      expect(verify.rows[0]!.name).toBe('Alice2');
    });

    it('executes DELETE statements', async () => {
      const res = await adapter.execute('DELETE FROM users WHERE id = 2');
      expect(res.rowCount).toBe(1);
    });

    it('handles parameterized queries', async () => {
      const res = await adapter.execute('SELECT * FROM users WHERE id = ?', [2]);
      expect(res.rows).toHaveLength(1);
      expect(res.rows[0]!.name).toBe('Bob');
    });
  });

  describe('Error Handling', () => {
    let adapter: SQLiteAdapter;

    beforeEach(() => {
      adapter = new SQLiteAdapter({ path: ':memory:' });
    });

    afterEach(async () => {
      await adapter.close();
    });

    it('throws error on syntax errors', async () => {
      await expect(adapter.execute('SELEC * FRM bad')).rejects.toThrow('syntax error');
    });

    it('throws error on missing tables', async () => {
      await expect(adapter.execute('SELECT * FROM non_existent')).rejects.toThrow('no such table');
    });
  });

  describe('Integration', () => {
    it('implements DatabaseAdapter interface correctly', () => {
      const adapter = new SQLiteAdapter({ path: ':memory:' });
      expect(adapter.dialect).toBe('sqlite');
      expect(adapter.name).toBe('sqlite');
      expect(typeof adapter.execute).toBe('function');
      expect(typeof adapter.introspectSchema).toBe('function');
      expect(typeof adapter.close).toBe('function');
    });
  });
});
