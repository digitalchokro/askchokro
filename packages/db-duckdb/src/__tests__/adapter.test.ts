import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { DuckDBAdapter } from '../index.js';

describe('@digitalchokro/db-duckdb', () => {
  let adapter: DuckDBAdapter;

  beforeEach(async () => {
    adapter = new DuckDBAdapter({ path: ':memory:' });
    // Seed test analytical tables
    await adapter.execute(`
      CREATE TABLE sales (
        id INTEGER PRIMARY KEY,
        product TEXT NOT NULL,
        amount DOUBLE,
        region TEXT
      );
    `);
    await adapter.execute(`
      CREATE TABLE line_items (
        item_id INTEGER PRIMARY KEY,
        sale_id INTEGER REFERENCES sales(id),
        quantity BIGINT
      );
    `);
    await adapter.execute(`
      INSERT INTO sales VALUES
        (1, 'Laptop', 1200.50, 'Asia'),
        (2, 'Phone', 800.00, 'Europe'),
        (3, 'Tablet', 450.25, 'Asia'),
        (4, 'Laptop', 1150.00, 'Americas');
    `);
    await adapter.execute(`
      INSERT INTO line_items VALUES
        (101, 1, 2),
        (102, 2, 1);
    `);
  });

  afterEach(async () => {
    await adapter.close();
  });

  describe('Initialization & Metadata', () => {
    it('implements DatabaseAdapter interface correctly', () => {
      expect(adapter.dialect).toBe('duckdb');
      expect(adapter.name).toBe('duckdb');
    });
  });

  describe('Query Execution', () => {
    it('executes simple SELECT statements', async () => {
      const result = await adapter.execute('SELECT 42 AS answer');
      expect(result.rows).toHaveLength(1);
      expect(result.rows[0]?.answer).toBe(42);
      expect(result.rowCount).toBe(1);
      expect(result.executionMs).toBeGreaterThanOrEqual(0);
    });

    it('performs OLAP aggregations accurately', async () => {
      const result = await adapter.execute(`
        SELECT region, SUM(amount) as total_sales, COUNT(*) as tx_count
        FROM sales
        GROUP BY region
        ORDER BY total_sales DESC
      `);

      expect(result.rows).toHaveLength(3);
      expect(result.rows[0]?.region).toBe('Asia');
      expect(Number(result.rows[0]?.total_sales)).toBeCloseTo(1650.75);
      expect(Number(result.rows[0]?.tx_count)).toBe(2);
    });

    it('handles parameterized queries', async () => {
      const result = await adapter.execute(
        'SELECT product, amount FROM sales WHERE region = ? ORDER BY amount DESC',
        ['Asia']
      );

      expect(result.rows).toHaveLength(2);
      expect(result.rows[0]?.product).toBe('Laptop');
    });

    it('normalizes BigInt and custom values for standard JSON serialization', async () => {
      const result = await adapter.execute('SELECT quantity FROM line_items WHERE item_id = ?', [101]);
      expect(result.rows).toHaveLength(1);
      expect(result.rows[0]?.quantity).toBe(2);
      expect(typeof result.rows[0]?.quantity).toBe('number');
      // Should be directly stringifiable without BigInt error
      expect(() => JSON.stringify(result.rows)).not.toThrow();
    });

    it('enforces read-only boundary guard when metadata.readOnly is true', async () => {
      await expect(
        adapter.execute('DROP TABLE sales', [], {
          tenantId: 'test',
          metadata: { readOnly: true },
        })
      ).rejects.toThrow('read-only mode: refusing to execute a non-SELECT statement');
    });
  });

  describe('Schema Introspection', () => {
    it('introspects table names, columns, and constraints', async () => {
      const schema = await adapter.introspectSchema();
      expect(schema.tables.some((t) => t.tableName === 'sales')).toBe(true);
      expect(schema.tables.some((t) => t.tableName === 'line_items')).toBe(true);

      const salesTable = schema.tables.find((t) => t.tableName === 'sales')!;
      expect(salesTable.columns.length).toBeGreaterThanOrEqual(4);

      const idCol = salesTable.columns.find((c) => c.columnName === 'id');
      expect(idCol?.isPrimaryKey).toBe(true);

      const itemsTable = schema.tables.find((t) => t.tableName === 'line_items')!;
      const fk = itemsTable.foreignKeys.find((f) => f.columnName === 'sale_id');
      expect(fk).toBeDefined();
      expect(fk?.referencedTable).toBe('sales');
      expect(fk?.referencedColumn).toBe('id');
    });
  });
});
