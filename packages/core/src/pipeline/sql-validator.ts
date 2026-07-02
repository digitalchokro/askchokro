import sqlParser from 'node-sql-parser';
import type { AST } from 'node-sql-parser';
import type { SQLValidator, ValidationResult } from '../interfaces/sql-validator';

const { Parser } = sqlParser;

export class DefaultSQLValidator implements SQLValidator {
  private parser: InstanceType<typeof Parser>;

  constructor() {
    this.parser = new Parser();
  }

  validate(
    sql: string,
    dialect: string,
    allowedTables?: string[],
    blockedTables?: string[],
    blockedColumns?: string[]
  ): ValidationResult {
    let ast: AST[] | AST;
    
    // 1. Parse the SQL
    try {
      // Map dialect to node-sql-parser database type
      // Our adapters use 'postgres', 'sqlite', 'mysql'
      const parserDialect = dialect === 'postgres' ? 'postgresql' : dialect;
      ast = this.parser.astify(sql, { database: parserDialect });
    } catch (e) {
      return {
        valid: false,
        reason: `Failed to parse SQL: ${e instanceof Error ? e.message : String(e)}`,
        violationType: 'parse_error',
      };
    }

    // AST can be an array if there are multiple statements
    const statements = Array.isArray(ast) ? ast : [ast];

    if (statements.length === 0) {
      return { valid: false, reason: 'Empty statement', violationType: 'parse_error' };
    }

    // 2. Validate statement type (must be SELECT)
    for (const stmt of statements) {
      if (stmt.type !== 'select') {
        return {
          valid: false,
          reason: `Only SELECT statements are allowed. Found: ${stmt.type}`,
          violationType: 'destructive_statement',
        };
      }
    }

    const parserDialect = dialect === 'postgres' ? 'postgresql' : dialect;

    // 3. Extract and check tables
    try {
      const tableList = this.parser.tableList(sql, { database: parserDialect });
      for (const tableEntry of tableList) {
        // node-sql-parser tableList format: 'type::database::table'
        const parts = tableEntry.split('::');
        const tableName = parts[parts.length - 1] as string; // get the actual table name

        if (blockedTables && blockedTables.includes(tableName)) {
          return {
            valid: false,
            reason: `Query references blocked table: ${tableName}`,
            violationType: 'blocked_table',
          };
        }

        if (allowedTables && !allowedTables.includes(tableName)) {
          return {
            valid: false,
            reason: `Query references unapproved table: ${tableName}`,
            violationType: 'blocked_table',
          };
        }
      }
    } catch {
      return { valid: false, reason: 'Failed to extract tables', violationType: 'parse_error' };
    }

    // 4. Extract and check columns
    if (blockedColumns && blockedColumns.length > 0) {
      try {
        const colList = this.parser.columnList(sql, { database: parserDialect });
        for (const colEntry of colList) {
          // node-sql-parser columnList format: 'select::table::column'
          const parts = colEntry.split('::');
          const columnName = parts[parts.length - 1] as string; // get the actual column name

          if (blockedColumns.includes(columnName)) {
            return {
              valid: false,
              reason: `Query references blocked column: ${columnName}`,
              violationType: 'blocked_column',
            };
          }
        }
      } catch {
        return { valid: false, reason: 'Failed to extract columns', violationType: 'parse_error' };
      }
    }

    return { valid: true };
  }
}
