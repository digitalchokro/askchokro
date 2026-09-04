import { describe, it, expect, beforeEach } from 'vitest';
import { DefaultSQLValidator } from '../../pipeline/sql-validator.js';

describe('DefaultSQLValidator', () => {
  let validator: DefaultSQLValidator;

  beforeEach(() => {
    validator = new DefaultSQLValidator();
  });

  describe('dialect translation', () => {
    // node-sql-parser rejects the string 'mssql' outright, so every SQL Server
    // query used to fail validation with a parse error.
    it('parses T-SQL under the mssql dialect name', () => {
      const result = validator.validate('SELECT TOP 10 id FROM users', 'mssql');
      expect(result.valid).toBe(true);
    });

    it.each(['postgres', 'mysql', 'sqlite'] as const)('parses a plain SELECT on %s', (dialect) => {
      expect(validator.validate('SELECT id FROM users', dialect).valid).toBe(true);
    });
  });

  describe('statement type', () => {
    it.each([
      ['DELETE FROM users'],
      ['UPDATE users SET name = \'x\''],
      ['INSERT INTO users (name) VALUES (\'x\')'],
      ['DROP TABLE users'],
    ])('rejects %s', (sql) => {
      const result = validator.validate(sql, 'postgres');
      expect(result.valid).toBe(false);
    });

    it('reports unparseable SQL as a parse error', () => {
      const result = validator.validate('SELECT FROM WHERE', 'postgres');
      expect(result.valid).toBe(false);
      expect(result.violationType).toBe('parse_error');
    });
  });

  // Unquoted SQL identifiers are case-insensitive, and the model writes
  // whatever case it likes. A case-sensitive list check let `SELECT * FROM
  // Secrets` slip past a `secrets` block entry.
  describe('case-insensitive identifier matching', () => {
    it('blocks a table listed in a different case', () => {
      const result = validator.validate('SELECT * FROM Secrets', 'postgres', undefined, ['secrets']);
      expect(result.valid).toBe(false);
      expect(result.violationType).toBe('blocked_table');
    });

    it('blocks a table written in lower case against an upper-case block entry', () => {
      const result = validator.validate('SELECT * FROM secrets', 'postgres', undefined, ['SECRETS']);
      expect(result.valid).toBe(false);
      expect(result.violationType).toBe('blocked_table');
    });

    it('accepts an allowed table referenced in a different case', () => {
      const result = validator.validate('SELECT * FROM Users', 'postgres', ['users']);
      expect(result.valid).toBe(true);
    });

    it('still rejects a table missing from the allow list', () => {
      const result = validator.validate('SELECT * FROM orders', 'postgres', ['users']);
      expect(result.valid).toBe(false);
      expect(result.violationType).toBe('blocked_table');
    });

    it('blocks a column listed in a different case', () => {
      const result = validator.validate(
        'SELECT Password FROM users',
        'postgres',
        undefined,
        undefined,
        ['password'],
      );
      expect(result.valid).toBe(false);
      expect(result.violationType).toBe('blocked_column');
    });

    it('matches a quoted identifier against an unquoted list entry', () => {
      const result = validator.validate('SELECT * FROM "Secrets"', 'postgres', undefined, ['secrets']);
      expect(result.valid).toBe(false);
      expect(result.violationType).toBe('blocked_table');
    });

    it('leaves an unrelated table alone', () => {
      const result = validator.validate('SELECT * FROM users', 'postgres', undefined, ['secrets']);
      expect(result.valid).toBe(true);
    });
  });
});
