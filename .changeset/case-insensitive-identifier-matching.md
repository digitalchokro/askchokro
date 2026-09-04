---
'@digitalchokro/core': patch
---

Match SQL identifiers case-insensitively in the tenant scope rewriter and the SQL validator.

Unquoted identifiers are case-insensitive in SQL, but both the rewriter's `scopedTables` and the validator's allow/block lists were compared with a case-sensitive `includes()`. Two consequences, both security-relevant:

- A model that wrote `FROM Users` against a `['users']` scoping policy fell straight through the scoping loop, so the query ran **unscoped and returned every tenant's rows**.
- `SELECT * FROM Secrets` passed a `secrets` block-list entry.

Both lists now normalise case on each side of the comparison. Tables absent from `scopedTables` are still left unscoped, in any case, as before.
