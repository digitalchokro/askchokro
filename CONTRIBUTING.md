# Contributing to AskChokro

Thank you for contributing to AskChokro! This document explains how to set up your development environment and submit changes.

## Development Setup

### Prerequisites
- Node.js >= 18
- pnpm >= 9 (`npm install -g pnpm`)
- Docker (for integration tests against real databases)

### Getting Started

```bash
# Clone the repo
git clone https://github.com/digitalchokro/askchokro.git
cd askchokro

# Install all dependencies
pnpm install

# Build all packages
pnpm build

# Run all tests
pnpm test
```

### Monorepo Structure

This is a pnpm workspace monorepo orchestrated by Turborepo. Each package in `packages/` is independently publishable to npm under the `@digitalchokro` scope.

- `packages/core/` — The engine. All interfaces, pipeline, and types.
- `packages/db-*/` — Database adapters (Postgres, SQLite, etc.).
- `packages/provider-*/` — AI provider adapters (Ollama, OpenAI, etc.).
- `packages/adapter-*/` — Web framework middleware (Express, Next.js, etc.).
- `packages/cli/` — The `npx askchokro` CLI.

### Running Tests

```bash
# All tests
pnpm test

# Tests for a specific package
pnpm --filter @digitalchokro/core test

# Security ("evil") tests only
pnpm test:security

# Accuracy eval harness
pnpm eval
```
## Good First Issues

Looking for a place to start? We have specifically reserved several features for new contributors to tackle. These are well-defined and have existing patterns in the codebase you can copy:

- **MySQL Adapter Tests**: We have the basic `db-mysql` adapter, but it lacks comprehensive Docker-based integration tests. Help us verify it against real MySQL instances!
- **Gemini Provider**: Create `provider-gemini` using Google's generative-ai SDK. You can use the existing `provider-openai` package as a template.
- **Fastify Adapter**: Create `adapter-fastify`. Next.js and Express are done, so you can copy the Express middleware logic and adapt it for Fastify.
- **Hono Adapter**: Create `adapter-hono` to bring AskChokro to edge runtimes like Cloudflare Workers.

If you want to claim one of these, open an issue on GitHub and we will assign it to you!

## Adding a New AI Provider

This is a great first contribution! See the `add-provider` issue template for step-by-step guidance.

1. Create `packages/provider-yourprovider/`.
2. Implement the `AIProvider` interface from `@digitalchokro/core`.
3. Add unit tests.
4. Add an entry to `docs/RECOMMENDED_MODELS.md` if you have eval data.
5. Open a PR.

## Adding a New Database Adapter

1. Create `packages/db-yourdb/`.
2. Implement the `DatabaseAdapter` interface from `@digitalchokro/core`.
3. Add unit + integration tests (Docker-based).
4. Open a PR.

## Pull Request Process

1. Fork the repo and create a branch from `main`.
2. Make your changes. Run `pnpm lint && pnpm typecheck && pnpm test`.
3. If you add a new feature, add tests. If you fix a bug, add a regression test.
4. Write a clear PR description explaining *what* and *why*.
5. A maintainer will review within 48 hours.

## Code Style

- TypeScript strict mode. No `any`.
- Comments explain *why*, not *what*.
- Consistent naming: `*Provider` for AI, `*Adapter` for DB, `*Strategy` for algorithms.
- Every public function validates inputs and throws `AskChokroError`.

## Commit Messages

We use [Conventional Commits](https://www.conventionalcommits.org/):

```
feat(core): add schema annotations support
fix(db-postgres): handle connection timeout gracefully
docs: update RECOMMENDED_MODELS.md for Qwen3
test(security): add cross-tenant CTE test case
```

## License

By contributing, you agree that your contributions will be licensed under the MIT License.
