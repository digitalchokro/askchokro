---
'@digitalchokro/core': patch
---

Translate the `mssql` dialect name before handing SQL to the parser.

`node-sql-parser` accepts `transactsql` and rejects the string `mssql`, which is the dialect `@digitalchokro/db-mssql` reports. Every SQL Server query therefore failed validation with a parse error, and — because the tenant rewriter fails closed — every SQL Server tenant rewrite failed too. A new `toParserDialect()` maps the adapter's dialect name onto the parser's, and is exported for plugin authors writing their own validators.
