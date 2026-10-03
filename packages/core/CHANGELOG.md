# @digitalchokro/core

## 1.2.0

### Minor Changes

- c44a207: Add `sqlCacheTtl` to `AgentOptions`, and export the SQL guards and cache provider.

  `sqlCacheTtl` sets the TTL for the question → generated-SQL cache (Tier 1), which was previously fixed at one hour with no way to change it. Lower it so schema changes and prompt tuning take effect sooner, since a cached question bypasses the model entirely until its entry expires.

  `applyRowLimit`, `isCannotAnswer`, `CANNOT_ANSWER_SQL` and `InMemoryCacheProvider` are now public exports. The `CANNOT_ANSWER` sentinel in particular was being recognised by ad-hoc string comparison in each provider; sharing one predicate means every provider agrees on what counts as a refusal.

- c44a207: Report real prompt and completion token counts on `AskResult.tokenUsage`.

  `AIProvider` gains an optional `consumeUsage(): TokenUsage`, which returns the usage accumulated since the last call and resets the counter — a drain, not a peek. The agent drains after generation and again after formatting, so one question's total covers every model call made for it, retries included. All six bundled providers implement it, including across streaming responses. Providers that cannot report usage simply omit the method and `tokenUsage` stays at zero rather than being estimated.

  Also exported from `@digitalchokro/core` for plugin authors: the `TokenUsage` type and the `UsageAccumulator` helper the bundled providers use.

### Patch Changes

- 96c57bc: Match SQL identifiers case-insensitively in the tenant scope rewriter and the SQL validator.

  Unquoted identifiers are case-insensitive in SQL, but both the rewriter's `scopedTables` and the validator's allow/block lists were compared with a case-sensitive `includes()`. Two consequences, both security-relevant:

  - A model that wrote `FROM Users` against a `['users']` scoping policy fell straight through the scoping loop, so the query ran **unscoped and returned every tenant's rows**.
  - `SELECT * FROM Secrets` passed a `secrets` block-list entry.

  Both lists now normalise case on each side of the comparison. Tables absent from `scopedTables` are still left unscoped, in any case, as before.

- c44a207: Implement `increment()` on `InMemoryCacheProvider` so per-tenant rate limiting works with the default cache.

  The counter's expiry is set only when the counter is created, so the window runs a fixed `windowSeconds` from the first request instead of sliding forward on every hit — a steady stream of traffic can no longer hold the window open indefinitely and prevent the count from ever resetting. Note that a fixed window inherently permits up to 2× `maxRequests` across a window boundary, and that this provider is per-process: use a Redis-backed cache to rate limit across instances.

- 96c57bc: Translate the `mssql` dialect name before handing SQL to the parser.

  `node-sql-parser` accepts `transactsql` and rejects the string `mssql`, which is the dialect `@digitalchokro/db-mssql` reports. Every SQL Server query therefore failed validation with a parse error, and — because the tenant rewriter fails closed — every SQL Server tenant rewrite failed too. A new `toParserDialect()` maps the adapter's dialect name onto the parser's, and is exported for plugin authors writing their own validators.

## 1.1.6

### Patch Changes

- 0441f9e: chore: standardize all package.json manifests with complete metadata (exports, repository, license, author)

## 1.1.5

### Patch Changes

- dccaf30: docs: fix broken INTEGRATION_ARCHITECTURE.md links across all package READMEs to use absolute root repository URLs

## 1.1.4

### Patch Changes

- dc07763: Dynamic few-shot examples that automatically adjust date syntax between Postgres (`date_trunc`) and SQLite (`strftime`) based on the active database dialect.

## 1.1.3

### Patch Changes

- 2e2e0d8: Perform full security and quality audit:
  - Significantly improve local model accuracy (12x improvement) via Dialect-Aware Few-Shot prompting.
  - Fix unused variable blocking CI linting pipeline.
  - Scaffold test suites for CLI and ecosystem providers to improve maintenance coverage.
  - Enable automated GitHub Releases.

## 1.1.2

### Patch Changes

- d7203db: chore: fix security audit vulnerabilities in devDependencies and add sourcemaps to clear obfuscation warnings

## 1.1.1

### Patch Changes

- 36e2695: docs: fix outdated limitations and proofread documentation regarding multi-part questions

## 1.1.0

### Minor Changes

- b678fce: docs: add full Bengali translation of the README and distribute to all packages

### Patch Changes

- 82b3ae4: docs: humanize Bengali translation of README for fluent natural tone

## 1.0.5

### Patch Changes

- 6c47cfd: docs: include README.md in all packages for NPM registry display

## 1.0.4

### Patch Changes

- 75ac706: chore: Optimize AEO/SEO metadata and secure supply chain via .npmignore

## 1.0.2

### Patch Changes

- fix: safely strip trailing semicolons before appending the LIMIT clause to LLM-generated SQL

## 1.0.1

### Patch Changes

- fix: correctly map all internal dependencies to @digitalchokro/askchokro namespace and resolve broken 1.0.0 references

## 1.0.0

### Major Changes

- v1.0.0 Stable Release!
  - Accuracy benchmarks published
  - Added Anthropic (Claude 3.5 Sonnet) Provider
  - Full multi-tenant isolation testing complete
  - Core API surface locked in

### Minor Changes

- b381260: Initial alpha release for AskChokro!
  - Zero-config DatabaseAgent
  - AST Tenant Rewriting
  - SQLite & Postgres adapters
  - OpenAI & Ollama providers
  - Next.js & Express adapters
  - Viral `npx askchokro demo` CLI

## 0.1.0-alpha.0

### Minor Changes

- Initial alpha release for AskChokro!
  - Zero-config DatabaseAgent
  - AST Tenant Rewriting
  - SQLite & Postgres adapters
  - OpenAI & Ollama providers
  - Next.js & Express adapters
  - Viral `npx askchokro demo` CLI
