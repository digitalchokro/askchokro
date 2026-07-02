# askchokro

## 1.0.2

### Patch Changes

- fix: read ASKCHOKRO_MODEL from environment variables correctly in auto-detect logic

## 1.0.1

### Patch Changes

- fix: correctly map all internal dependencies to @digitalchokro/askchokro namespace and resolve broken 1.0.0 references
- 71d752a: feat: add ASKCHOKRO_PROVIDER override to bypass broken OPENAI_API_KEYs
- Updated dependencies
  - @digitalchokro/core@1.0.1
  - @digitalchokro/db-postgres@1.0.1
  - @digitalchokro/db-sqlite@1.0.1
  - @digitalchokro/provider-ollama@1.0.1
  - @digitalchokro/provider-openai@1.0.1

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

### Patch Changes

- Updated dependencies [b381260]
- Updated dependencies
  - @digitalchokro/core@1.0.0
  - @digitalchokro/db-postgres@1.0.0
  - @digitalchokro/db-sqlite@1.0.0
  - @digitalchokro/provider-ollama@1.0.0
  - @digitalchokro/provider-openai@1.0.0

## 0.1.0-alpha.0

### Minor Changes

- Initial alpha release for AskChokro!
  - Zero-config DatabaseAgent
  - AST Tenant Rewriting
  - SQLite & Postgres adapters
  - OpenAI & Ollama providers
  - Next.js & Express adapters
  - Viral `npx askchokro demo` CLI

### Patch Changes

- Updated dependencies
  - @digitalchokro/core@0.1.0-alpha.0
  - @digitalchokro/db-postgres@1.0.0-alpha.0
  - @digitalchokro/db-sqlite@1.0.0-alpha.0
  - @digitalchokro/provider-ollama@1.0.0-alpha.0
  - @digitalchokro/provider-openai@1.0.0-alpha.0
