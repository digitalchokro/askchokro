# @digitalchokro/core

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
