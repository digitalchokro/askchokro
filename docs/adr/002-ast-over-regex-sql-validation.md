# ADR 002: AST-Based SQL Validation Over Regex

## Status
Accepted

## Context
The SQL validator must prevent the execution of destructive SQL statements (DROP, DELETE, UPDATE, INSERT, TRUNCATE, ALTER, GRANT). The naive approach is keyword matching — checking if the SQL string contains forbidden words. This is fundamentally unreliable.

### Why keyword matching fails
- `SELECT * FROM orders WHERE description LIKE '%drop%'` — a legitimate query that contains the word "drop".
- `SELECT * FROM users; DROP TABLE users; --` — SQL injection via statement chaining. Keyword matching would need to understand statement boundaries.
- `WITH deleted AS (DELETE FROM orders RETURNING *) SELECT * FROM deleted` — a CTE-wrapped destructive operation that starts with SELECT.

## Decision
We use `node-sql-parser` to parse the SQL string into an Abstract Syntax Tree (AST), then walk the tree to verify:
1. The root statement type is `SELECT` (not `INSERT`, `UPDATE`, `DELETE`, etc.).
2. No nested statement within a CTE or subquery is destructive.
3. All table references are checked against the allow/blocklist.
4. All column references are checked against the blocked columns list.

The parser must be **dialect-aware** — Postgres, MySQL, and SQLite have different grammars for quoting, LIMIT/OFFSET, RETURNING clauses, etc. `node-sql-parser` supports this via a `database` option.

## Consequences
- `node-sql-parser` becomes a runtime dependency of the default SQLValidator implementation.
- Any SQL that cannot be parsed (e.g., exotic dialect extensions) is rejected by default — fail closed.
- This is significantly more reliable than regex, at the cost of a small parse overhead (~1-5ms per query).
