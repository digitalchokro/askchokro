# ADR 003: AST-Level Tenant Scope Rewriting

## Status
Accepted

## Context
AskChokro targets SaaS developers building multi-tenant applications. When a user asks "Show me my orders", the generated SQL must be scoped to that user's tenant (organization/business). This is the most security-critical mechanism in the system.

### Why string-appending "WHERE tenant_id = ?" is not safe

Consider this AI-generated query:
```sql
SELECT o.*, u.email
FROM orders o
JOIN users u ON o.user_id = u.id
WHERE o.status = 'pending'
```

A naive string-append produces:
```sql
SELECT o.*, u.email
FROM orders o
JOIN users u ON o.user_id = u.id
WHERE o.status = 'pending'
AND orders.business_id = 42
```

**Problem:** The `users` table in the JOIN is NOT scoped. If users from Tenant A and Tenant B share user IDs, this query leaks cross-tenant user data. It passes a naive check because the orders table IS filtered — but the join target is wide open.

The problem is worse with CTEs:
```sql
WITH recent_orders AS (SELECT * FROM orders WHERE created_at > '2024-01-01')
SELECT * FROM recent_orders
```
String-appending to the outer query does not affect the inner CTE, which reads ALL tenants.

### Why this is worse than a missing feature
A missing feature produces an error. An incorrectly scoped query produces **silently correct-looking results that contain another tenant's data**. This is a data breach that looks like it passed the safety check.

## Decision
We rewrite the SQL at the AST level using `node-sql-parser`:

1. Parse the generated SQL into an AST (dialect-aware).
2. Walk every `FROM` clause, every `JOIN` target, every CTE definition (`WITH` arm), and every `UNION` branch.
3. For each table reference that is in the tenant-scoped set, inject `tenant_column = $value` as an additional `AND` predicate.
4. Serialize the rewritten AST back to SQL using `sqlify()`.
5. **Fail closed:** If the query shape contains constructs the rewriter cannot handle with full confidence (e.g., deeply nested correlated subqueries with external references, or lateral joins with complex expressions), the rewriter returns `{ success: false }`. The pipeline then rejects the query and asks the AI to regenerate something simpler.

## Known Limitations (Document Honestly)

AST rewriting dramatically reduces the risk of cross-tenant leakage, but it **cannot guarantee full isolation** in every edge case. We must never claim "guaranteed safety" in our README or Security Guide. The correct framing is: *"dramatically reduces risk with a fail-closed design."*

| Limitation | Why It's Hard | Mitigation |
|---|---|---|
| **Database Views** | The rewriter sees view names as table references but cannot introspect the underlying SQL. If a view internally joins across tenants, the rewriter cannot catch it. | Document that developers must ensure views are already tenant-scoped at the DB level, or add views to `blockedTables`. |
| **Correlated Subqueries** | Deeply nested correlated subqueries with external table references create AST structures the rewriter may not traverse fully. | Fail-closed: reject and force AI regeneration. |
| **CTE Alias Shadowing** | A CTE named identically to a real table can confuse the scope injector about which "table" it's processing. | Fail-closed catches this. The rewriter checks for CTE name collisions with the scoped-tables set. |
| **Dialect-Specific Syntax** | Postgres `LATERAL` joins, MySQL `STRAIGHT_JOIN`, SQLite `INDEXED BY` — parser coverage varies. | Fail-closed: any unparsed syntax causes rejection. |
| **ORM-Generated SQL** | ORMs sometimes produce non-standard SQL constructs (e.g., Prisma's `_count`, Drizzle's custom operators). | Fail-closed: non-standard SQL fails to parse. |

## Consequences
- This is the most complex piece of code in the entire codebase. It deserves its own dedicated test suite including property-based fuzz testing with `fast-check`.
- The fuzz corpus must include: multi-table JOINs, CTEs, UNIONs, subqueries, self-joins, and combinations thereof — all with tenant scoping enabled.
- `node-sql-parser`'s `sqlify()` may produce SQL with slightly different formatting than the original. This is acceptable — correctness over aesthetics.
- Some legitimate but exotic query shapes will be rejected. This is the correct trade-off: fail closed is always better than fail open for a security boundary.
- The README and Security Guide must never claim "guaranteed isolation." The framing is: "9-layer defense-in-depth with a fail-closed design."
