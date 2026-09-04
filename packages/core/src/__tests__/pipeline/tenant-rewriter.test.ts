/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-return, @typescript-eslint/unbound-method, @typescript-eslint/explicit-function-return-type, @typescript-eslint/no-unnecessary-type-assertion */
import { describe, it, expect } from 'vitest';
import { DefaultTenantScopeRewriter } from '../../pipeline/tenant-rewriter.js';

describe('DefaultTenantScopeRewriter', () => {
  const rewriter = new DefaultTenantScopeRewriter();

  it('injects tenant scope into a simple SELECT', () => {
    const sql = 'SELECT * FROM users';
    const result = rewriter.rewrite(sql, 'postgres', 'tenant_id', 5);
    
    expect(result.success).toBe(true);
    expect(result.sql).toMatch(/tenant_id.*=.*5/i);
    expect(result.sql).toMatch(/WHERE/i);
  });

  it('injects tenant scope into INNER JOIN and preserves ON clause', () => {
    const sql = 'SELECT * FROM users u INNER JOIN orders o ON u.id = o.user_id';
    const result = rewriter.rewrite(sql, 'postgres', 'tenant_id', 5);
    
    expect(result.success).toBe(true);
    expect(result.sql).toMatch(/ON.*u.*id.*=.*o.*user_id.*AND.*tenant_id.*=.*5/i);
    expect(result.sql).toMatch(/WHERE.*tenant_id.*=.*5/i);
  });

  it('injects tenant scope into LEFT JOIN to ON clause, avoiding INNER JOIN conversion', () => {
    const sql = 'SELECT * FROM users u LEFT JOIN orders o ON u.id = o.user_id';
    const result = rewriter.rewrite(sql, 'postgres', 'tenant_id', 5);
    
    expect(result.success).toBe(true);
    expect(result.sql).toMatch(/LEFT JOIN.*orders.*o.*ON.*u.*id.*=.*o.*user_id.*AND.*tenant_id.*=.*5/i);
    expect(result.sql).toMatch(/WHERE.*tenant_id.*=.*5/i);
  });

  it('only scopes specified tables if scopedTables is provided', () => {
    const sql = 'SELECT * FROM users u LEFT JOIN global_config c ON u.id = c.user_id';
    const result = rewriter.rewrite(sql, 'postgres', 'tenant_id', 5, ['users']);
    
    expect(result.success).toBe(true);
    expect(result.sql).toMatch(/WHERE.*tenant_id.*=.*5/i);
    expect(result.sql).not.toMatch(/ON.*AND.*tenant_id.*=.*5/i);
  });

  it('fails gracefully on invalid SQL', () => {
    const sql = 'SELECT * FROM WHERE INVALID SYNTAX';
    const result = rewriter.rewrite(sql, 'postgres', 'tenant_id', 5);

    expect(result.success).toBe(false);
    expect(result.reason).toContain('Failed to parse SQL');
  });

  // ─── Adversarial / isolation-critical shapes ──────────────────────────────

  it('scopes BOTH arms of a UNION (no cross-tenant leak via the second arm)', () => {
    const sql = 'SELECT * FROM orders UNION SELECT * FROM orders_archive';
    const result = rewriter.rewrite(sql, 'postgres', 'tenant_id', 5);

    expect(result.success).toBe(true);
    // Every select arm must carry the tenant filter — count the occurrences.
    const matches = result.sql!.match(/tenant_id"?\s*=\s*5/gi) ?? [];
    expect(matches.length).toBe(2);
  });

  it('scopes a subquery in a WHERE ... IN clause', () => {
    const sql = 'SELECT * FROM orders WHERE user_id IN (SELECT id FROM users)';
    const result = rewriter.rewrite(sql, 'postgres', 'tenant_id', 5);

    expect(result.success).toBe(true);
    // Outer `orders` and inner `users` both scoped.
    const matches = result.sql!.match(/tenant_id"?\s*=\s*5/gi) ?? [];
    expect(matches.length).toBe(2);
  });

  it('scopes the SELECT inside a CTE', () => {
    const sql = 'WITH recent AS (SELECT * FROM orders) SELECT * FROM recent';
    const result = rewriter.rewrite(sql, 'postgres', 'tenant_id', 5);

    expect(result.success).toBe(true);
    expect(result.sql).toMatch(/tenant_id"?\s*=\s*5/i);
  });

  it('escapes a tenant value containing SQL metacharacters (no injection)', () => {
    // A hostile tenant id must be emitted as a quoted, escaped string literal,
    // never as raw SQL that could break out of the predicate.
    const evil = "acme' OR '1'='1";
    const result = rewriter.rewrite('SELECT * FROM users', 'postgres', 'tenant_id', evil);

    expect(result.success).toBe(true);
    // The doubled single-quote is how the value stays inside one string literal.
    expect(result.sql).toMatch(/'acme'' OR ''1''=''1'/);
    // And it must NOT appear as a bare, unescaped OR predicate.
    expect(result.sql).not.toMatch(/=\s*'acme'\s+OR\s+'1'\s*=\s*'1'/i);
  });
  // SQL identifiers are case-insensitive but `scopedTables` was compared with
  // `includes()`. A model writing `FROM Users` against a `['users']` policy
  // therefore fell through the scoping loop and returned every tenant's rows.
  describe('case-insensitive scopedTables matching', () => {
    it('scopes a table the model wrote in a different case', () => {
      const result = rewriter.rewrite('SELECT * FROM Users', 'postgres', 'tenant_id', 5, ['users']);

      expect(result.success).toBe(true);
      expect(result.sql).toMatch(/WHERE.*tenant_id.*=.*5/i);
    });

    it('scopes a lower-case table against an upper-case policy entry', () => {
      const result = rewriter.rewrite('SELECT * FROM users', 'postgres', 'tenant_id', 5, ['USERS']);

      expect(result.success).toBe(true);
      expect(result.sql).toMatch(/WHERE.*tenant_id.*=.*5/i);
    });

    it('scopes a joined table listed in a different case', () => {
      const result = rewriter.rewrite(
        'SELECT * FROM users u LEFT JOIN Orders o ON u.id = o.user_id',
        'postgres',
        'tenant_id',
        5,
        ['users', 'orders'],
      );

      expect(result.success).toBe(true);
      expect(result.sql).toMatch(/ON.*AND.*tenant_id.*=.*5/i);
      expect(result.sql).toMatch(/WHERE.*tenant_id.*=.*5/i);
    });

    it('still leaves a table off the list unscoped, whatever its case', () => {
      const result = rewriter.rewrite(
        'SELECT * FROM users u LEFT JOIN Global_Config c ON u.id = c.user_id',
        'postgres',
        'tenant_id',
        5,
        ['users'],
      );

      expect(result.success).toBe(true);
      expect(result.sql).toMatch(/WHERE.*tenant_id.*=.*5/i);
      expect(result.sql).not.toMatch(/ON.*AND.*tenant_id.*=.*5/i);
    });
  });

  // The rewriter runs after validation, so it sees the same dialect string the
  // adapter reports. node-sql-parser rejects 'mssql', which made every SQL
  // Server rewrite fail closed.
  it('rewrites T-SQL under the mssql dialect name', () => {
    const result = rewriter.rewrite('SELECT TOP 10 * FROM users', 'mssql', 'tenant_id', 5);

    expect(result.success).toBe(true);
    expect(result.sql).toMatch(/tenant_id/i);
  });

  it('preserves an existing WHERE clause alongside the tenant filter', () => {
    const result = rewriter.rewrite(
      "SELECT * FROM users WHERE name = 'bob'",
      'postgres',
      'tenant_id',
      5,
    );

    expect(result.success).toBe(true);
    expect(result.sql).toMatch(/name.*=.*'bob'/i);
    expect(result.sql).toMatch(/tenant_id.*=.*5/i);
  });

  it('scopes a string tenant value as a string literal', () => {
    const result = rewriter.rewrite('SELECT * FROM users', 'postgres', 'tenant_id', 'acme');

    expect(result.success).toBe(true);
    expect(result.sql).toMatch(/tenant_id.*=.*'acme'/i);
  });
});
