# askchokro

## 2.0.2

### Patch Changes

- d7203db: chore: fix security audit vulnerabilities in devDependencies and add sourcemaps to clear obfuscation warnings
- Updated dependencies [d7203db]
  - @digitalchokro/core@1.1.2
  - @digitalchokro/db-mysql@2.0.2
  - @digitalchokro/db-postgres@2.0.2
  - @digitalchokro/db-sqlite@2.0.2
  - @digitalchokro/provider-anthropic@2.0.2
  - @digitalchokro/provider-gemini@1.1.2
  - @digitalchokro/provider-ollama@2.0.2
  - @digitalchokro/provider-openai@2.0.2
  - @digitalchokro/vector-memory@2.0.2

## 2.0.1

### Patch Changes

- 36e2695: docs: fix outdated limitations and proofread documentation regarding multi-part questions
- Updated dependencies [36e2695]
  - @digitalchokro/core@1.1.1
  - @digitalchokro/db-mysql@2.0.1
  - @digitalchokro/db-postgres@2.0.1
  - @digitalchokro/db-sqlite@2.0.1
  - @digitalchokro/provider-anthropic@2.0.1
  - @digitalchokro/provider-gemini@1.1.1
  - @digitalchokro/provider-ollama@2.0.1
  - @digitalchokro/provider-openai@2.0.1
  - @digitalchokro/vector-memory@2.0.1

## 2.0.0

### Minor Changes

- b678fce: docs: add full Bengali translation of the README and distribute to all packages

### Patch Changes

- 82b3ae4: docs: humanize Bengali translation of README for fluent natural tone
- Updated dependencies [b678fce]
- Updated dependencies [82b3ae4]
  - @digitalchokro/core@1.1.0
  - @digitalchokro/db-mysql@2.0.0
  - @digitalchokro/db-postgres@2.0.0
  - @digitalchokro/db-sqlite@2.0.0
  - @digitalchokro/provider-anthropic@2.0.0
  - @digitalchokro/provider-gemini@1.1.0
  - @digitalchokro/provider-ollama@2.0.0
  - @digitalchokro/provider-openai@2.0.0
  - @digitalchokro/vector-memory@2.0.0

## 1.1.1

### Patch Changes

- 6c47cfd: docs: include README.md in all packages for NPM registry display
- Updated dependencies [6c47cfd]
  - @digitalchokro/core@1.0.5
  - @digitalchokro/db-mysql@1.0.2
  - @digitalchokro/db-postgres@1.0.5
  - @digitalchokro/db-sqlite@1.0.5
  - @digitalchokro/provider-anthropic@1.0.5
  - @digitalchokro/provider-gemini@1.0.6
  - @digitalchokro/provider-ollama@1.0.5
  - @digitalchokro/provider-openai@1.0.5
  - @digitalchokro/vector-memory@1.0.2

## 1.1.0

### Minor Changes

- aaad1a2: feat: add Anthropic (Claude) auto-detection and environment variable support

### Patch Changes

- 75ac706: chore: Optimize AEO/SEO metadata and secure supply chain via .npmignore
- Updated dependencies [75ac706]
  - @digitalchokro/core@1.0.4
  - @digitalchokro/db-mysql@1.0.1
  - @digitalchokro/db-postgres@1.0.4
  - @digitalchokro/db-sqlite@1.0.4
  - @digitalchokro/provider-anthropic@1.0.4
  - @digitalchokro/provider-gemini@1.0.5
  - @digitalchokro/provider-ollama@1.0.4
  - @digitalchokro/provider-openai@1.0.4
  - @digitalchokro/vector-memory@1.0.1

## 1.0.3

### Patch Changes

- Updated dependencies
  - @digitalchokro/core@1.0.2
  - @digitalchokro/db-postgres@1.0.2
  - @digitalchokro/db-sqlite@1.0.2
  - @digitalchokro/provider-ollama@1.0.2
  - @digitalchokro/provider-openai@1.0.2

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
