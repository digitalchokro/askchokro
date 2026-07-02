/**
 * @digitalchokro/core — Tenant Scope Rewriter Interface
 *
 * Rewrites generated SQL at the AST level to inject tenant isolation predicates
 * onto EVERY table reference — FROM clauses, JOINs, CTEs, UNION branches.
 *
 * This is NOT string-appending "WHERE tenant_id = ?". That approach fails on
 * JOINs and CTEs, creating cross-tenant data leaks.
 * See ADR 003 for the full rationale.
 */

export interface TenantRewriteResult {
  /** Whether the rewrite succeeded. */
  success: boolean;
  /** The rewritten SQL with tenant predicates injected. */
  sql?: string;
  /**
   * If the query shape is too complex for the rewriter to handle with
   * certainty (e.g., deeply nested correlated subqueries), this will be
   * false and the caller must reject the query and force a regeneration
   * from the AI. Fail closed, never fail open.
   */
  reason?: string;
}

export interface TenantScopeRewriter {
  /**
   * Walk the parsed AST and inject `tenantColumn = tenantValue` onto every
   * table reference that appears in the tenant-scoped table set.
   *
   * @param sql - The raw SQL string to rewrite.
   * @param dialect - The SQL dialect for correct AST parsing.
   * @param tenantColumn - The column name (e.g., 'business_id').
   * @param tenantValue - The actual tenant ID value to inject.
   * @param scopedTables - The set of tables that should be tenant-scoped.
   *                       If empty, all tables are scoped.
   */
  rewrite(
    sql: string,
    dialect: string,
    tenantColumn: string,
    tenantValue: string | number,
    scopedTables?: string[],
  ): TenantRewriteResult;
}
