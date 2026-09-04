import { describe, it, expect } from 'vitest';
import { applyRowLimit, isCannotAnswer, CANNOT_ANSWER_SQL } from '../../pipeline/sql-guards.js';

describe('applyRowLimit', () => {
  describe('LIMIT dialects', () => {
    it('appends a LIMIT when the query has none', () => {
      expect(applyRowLimit('SELECT * FROM users', 100, 'postgres')).toBe(
        'SELECT * FROM users LIMIT 100',
      );
    });

    it('strips a trailing semicolon before appending', () => {
      expect(applyRowLimit('SELECT * FROM users;', 100, 'postgres')).toBe(
        'SELECT * FROM users LIMIT 100',
      );
    });

    it('leaves a smaller existing LIMIT alone', () => {
      expect(applyRowLimit('SELECT * FROM users LIMIT 10', 100, 'postgres')).toBe(
        'SELECT * FROM users LIMIT 10',
      );
    });

    it('clamps an existing LIMIT that exceeds maxRows', () => {
      expect(applyRowLimit('SELECT * FROM users LIMIT 5000', 100, 'postgres')).toBe(
        'SELECT * FROM users LIMIT 100',
      );
    });

    it('clamps the row count in the MySQL "LIMIT offset, count" form', () => {
      expect(applyRowLimit('SELECT * FROM users LIMIT 20, 5000', 100, 'mysql')).toBe(
        'SELECT * FROM users LIMIT 20, 100',
      );
    });

    it('preserves a trailing OFFSET while clamping', () => {
      expect(applyRowLimit('SELECT * FROM users LIMIT 5000 OFFSET 40', 100, 'postgres')).toBe(
        'SELECT * FROM users LIMIT 100 OFFSET 40',
      );
    });

    // The cap used to be skipped whenever the SQL merely *contained* "limit",
    // which a string literal or a subquery is enough to trigger.
    it('still caps when LIMIT only appears inside a string literal', () => {
      expect(applyRowLimit("SELECT * FROM notes WHERE body = 'LIMIT 1'", 100, 'postgres')).toBe(
        "SELECT * FROM notes WHERE body = 'LIMIT 1' LIMIT 100",
      );
    });

    it('still caps when LIMIT only appears inside a subquery', () => {
      expect(
        applyRowLimit(
          'SELECT * FROM users WHERE id IN (SELECT id FROM admins LIMIT 1)',
          100,
          'postgres',
        ),
      ).toBe('SELECT * FROM users WHERE id IN (SELECT id FROM admins LIMIT 1) LIMIT 100');
    });
  });

  describe('T-SQL', () => {
    it('injects TOP instead of LIMIT for mssql', () => {
      expect(applyRowLimit('SELECT * FROM users', 100, 'mssql')).toBe(
        'SELECT TOP 100 * FROM users',
      );
    });

    it('preserves DISTINCT when injecting TOP', () => {
      expect(applyRowLimit('SELECT DISTINCT name FROM users', 100, 'mssql')).toBe(
        'SELECT DISTINCT TOP 100 name FROM users',
      );
    });

    it('clamps an existing TOP that exceeds maxRows', () => {
      expect(applyRowLimit('SELECT TOP 5000 * FROM users', 100, 'mssql')).toBe(
        'SELECT TOP 100 * FROM users',
      );
    });

    it('leaves a smaller existing TOP alone, including the parenthesised form', () => {
      expect(applyRowLimit('SELECT TOP (10) * FROM users', 100, 'mssql')).toBe(
        'SELECT TOP 10 * FROM users',
      );
    });

    it('returns non-SELECT input untouched rather than corrupting it', () => {
      expect(applyRowLimit('WITH cte AS (SELECT 1) SELECT * FROM cte', 100, 'mssql')).toBe(
        'WITH cte AS (SELECT 1) SELECT * FROM cte',
      );
    });
  });
});

describe('isCannotAnswer', () => {
  it('matches the exact sentinel', () => {
    expect(isCannotAnswer(CANNOT_ANSWER_SQL)).toBe(true);
  });

  it('matches regardless of case and whitespace', () => {
    expect(isCannotAnswer("  select   'CANNOT_ANSWER'   as   error  ")).toBe(true);
  });

  it('matches with a trailing semicolon', () => {
    expect(isCannotAnswer("SELECT 'CANNOT_ANSWER' AS error;")).toBe(true);
  });

  // sqlify() quotes the alias, and each dialect quotes it differently.
  it.each([
    ['double quotes', 'SELECT \'CANNOT_ANSWER\' AS "error"'],
    ['backticks', "SELECT 'CANNOT_ANSWER' AS `error`"],
    ['brackets', "SELECT 'CANNOT_ANSWER' AS [error]"],
  ])('matches when the alias is quoted with %s', (_label, sql) => {
    expect(isCannotAnswer(sql)).toBe(true);
  });

  it('does not match real SQL that mentions the sentinel', () => {
    expect(isCannotAnswer("SELECT * FROM logs WHERE msg = 'CANNOT_ANSWER'")).toBe(false);
  });

  it('does not match once a row limit has been appended', () => {
    expect(isCannotAnswer(`${CANNOT_ANSWER_SQL} LIMIT 100`)).toBe(false);
  });

  it('does not match an empty string', () => {
    expect(isCannotAnswer('')).toBe(false);
  });
});
