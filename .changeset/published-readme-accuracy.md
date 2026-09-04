---
'@digitalchokro/askchokro': patch
---

Correct the published README.

The npm README was a byte-identical copy of the root README, including two links to files that are gitignored and therefore absent from the package. Removed those, and replaced three inaccurate claims: "guaranteed immunity to SQL injection" (the AST layer rejects non-`SELECT` statements — it is not a substitute for a read-only database user), a "~85% line coverage" figure that was never measured, and a ">80%" eval threshold that did not match the 70% the CI actually enforces. The provider table now lists all six providers with their real default models.
