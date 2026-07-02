/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-argument */
import sqlParser from 'node-sql-parser';
import type { AST, Select } from 'node-sql-parser';
import type { TenantRewriteResult, TenantScopeRewriter } from '../interfaces/tenant-rewriter';

const { Parser } = sqlParser;

export class DefaultTenantScopeRewriter implements TenantScopeRewriter {
  private parser: InstanceType<typeof Parser>;

  constructor() {
    this.parser = new Parser();
  }

  rewrite(
    sql: string,
    dialect: string,
    tenantColumn: string,
    tenantValue: string | number,
    scopedTables?: string[]
  ): TenantRewriteResult {
    let ast: AST[] | AST;
    const parserDialect = dialect === 'postgres' ? 'postgresql' : dialect;

    try {
      ast = this.parser.astify(sql, { database: parserDialect });
    } catch (e) {
      return {
        success: false,
        reason: `Failed to parse SQL for rewriting: ${e instanceof Error ? e.message : String(e)}`,
      };
    }

    const statements = Array.isArray(ast) ? ast : [ast];

    try {
      for (const stmt of statements) {
        this.walkAndRewrite(stmt, tenantColumn, tenantValue, scopedTables);
      }
      
      const rewrittenSql = this.parser.sqlify(ast, { database: parserDialect });
      return { success: true, sql: rewrittenSql };
    } catch (e) {
      return {
        success: false,
        reason: `Failed to rewrite AST: ${e instanceof Error ? e.message : String(e)}`,
      };
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private walkAndRewrite(node: any, tenantColumn: string, tenantValue: string | number, scopedTables?: string[]): void {
    if (!node || typeof node !== 'object') {
      return;
    }

    // Recursively walk the AST
    for (const key of Object.keys(node)) {
      this.walkAndRewrite(node[key], tenantColumn, tenantValue, scopedTables);
    }

    // If we find a SELECT node, inject the tenant scope
    if (node.type === 'select' && Array.isArray(node.from)) {
      this.injectTenantScope(node as Select, tenantColumn, tenantValue, scopedTables);
    }
  }

  private injectTenantScope(
    selectNode: Select,
    tenantColumn: string,
    tenantValue: string | number,
    scopedTables?: string[]
  ): void {
    const conditions: any[] = [];

    const fromList = Array.isArray(selectNode.from) ? selectNode.from : (selectNode.from ? [selectNode.from] : []);

    // For every table in the FROM clause of this SELECT block
    for (const fromItem of fromList as any[]) {
      if (!fromItem.table) continue; // Could be a subquery, which will be handled recursively

      const tableName = String(fromItem.table);
      const alias = fromItem.as ? String(fromItem.as) : tableName;

      // Check if this table should be scoped
      if (scopedTables && scopedTables.length > 0 && !scopedTables.includes(tableName)) {
        continue;
      }

      // Create AST node for: alias.tenantColumn = tenantValue
      const condition = {
        type: 'binary_expr',
        operator: '=',
        left: {
          type: 'column_ref',
          table: alias,
          column: tenantColumn, // node-sql-parser expects column directly for simple names in some versions, but let's be safe.
        },
        right: {
          type: typeof tenantValue === 'number' ? 'number' : 'string',
          value: tenantValue,
        },
      };
      
      conditions.push(condition);
    }

    if (conditions.length === 0) {
      return;
    }

    // Combine all conditions with AND
    let combinedCondition = conditions[0];
    for (let i = 1; i < conditions.length; i++) {
      combinedCondition = {
        type: 'binary_expr',
        operator: 'AND',
        left: combinedCondition,
        right: conditions[i],
      };
    }

    // Inject into WHERE clause
    if (selectNode.where) {
      selectNode.where = {
        type: 'binary_expr',
        operator: 'AND',
        left: selectNode.where,
        right: combinedCondition,
      };
    } else {
      selectNode.where = combinedCondition;
    }
  }
}
