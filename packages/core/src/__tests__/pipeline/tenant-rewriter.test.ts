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
});
