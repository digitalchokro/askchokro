# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- All workspace packages now have standardized metadata (exports, repository, license, author fields).
- Dependabot automation for weekly npm dependency updates with auto-rebase.
- CLI test suite with real behavior tests for help text and command validation.
- Example project for local Ollama integration (100% offline AI setup).
- **Test suites for 12/15 packages** (159 tests total):
  - `core`: 29 tests — SQL validation, injection prevention, tenant rewriting, type system.
  - `askchokro`: 18 tests — auto-discovery, provider/adapter delegation, error forwarding.
  - `provider-openai`: 20 tests — initialization, message formatting, error handling, token counting.
  - `provider-anthropic`: 5 tests — generateSQL, formatResponse.
  - `provider-gemini`: 6 tests — SQL tag parsing, chart format extraction.
  - `provider-ollama`: 6 tests — fetch mock, request body validation.
  - `db-sqlite`: 13 tests — in-memory integration, schema extraction, DML execution.
  - `db-postgres`: 9 tests — Pool mock, information_schema introspection.
  - `db-mysql`: 8 tests — mysql2/promise mock, schema introspection.
  - `adapter-express`: 10 tests — middleware validation, error mapping, custom onError.
  - `adapter-nextjs`: 7 tests — App Router, NextResponse, JSON parsing.
  - `microservice`: 8 tests — supertest: /health deep check, JWT auth, tenant config.
- **`AskChokro.ping()` method** — deep health check that verifies database connectivity via `SELECT 1`.
- **WordPress Phase 1 completion:**
  - `.env.example` environment configuration template for the microservice.
  - Deep `/health` endpoint that verifies DB connectivity (returns 200 or 503).
  - Docker `HEALTHCHECK` directive in the Dockerfile.
  - Refactored microservice to export `createApp()` factory for testability.

### Fixed
- Type safety improvements in `@digitalchokro/provider-gemini` with strict runtime type guards.
- CLI entrypoint now import-safe and properly exports functions for testability.
- Removed stale "v0 stub" comments from completed provider and database adapter implementations.
- Fixed `AskChokroError` test assertions to use correct constructor signature `(code, message, suggestion)`.
- Fixed `TenantContext` usage in tests (`tenantId` not `tenant_id`).
- Fixed `AskChokro.ping()` to avoid accessing private `DatabaseAgent.config` (stores `dbAdapter` reference directly).

### Changed
- Enhanced package.json manifests across all 15 packages with complete metadata.
- All packages now follow consistent lifecycle scripts (build, lint, typecheck, test, clean).

## [2.0.4] and [1.1.4] - Recent Releases

### Previous Releases (v2.0.4 and v1.1.4)

Complete production implementations of:
- `@digitalchokro/core` — Core engine with interface contracts, pipeline, and types (v1.1.4).
- `@digitalchokro/db-postgres` — Production PostgreSQL adapter (v2.0.4).
- `@digitalchokro/db-sqlite` — Production SQLite adapter (v2.0.4).
- `@digitalchokro/db-mysql` — Production MySQL adapter (v2.0.4).
- `@digitalchokro/provider-ollama` — Production Ollama provider (v2.0.4).
- `@digitalchokro/provider-openai` — Production OpenAI provider (v2.0.4).
- `@digitalchokro/provider-anthropic` — Production Anthropic provider (v2.0.4).
- `@digitalchokro/provider-gemini` — Production Google Gemini provider (v1.1.4).
- `@digitalchokro/adapter-express` — Production Express middleware (v2.0.4).
- `@digitalchokro/adapter-nextjs` — Production Next.js App Router adapter (v2.0.4).
- `@digitalchokro/cli` — Production CLI tool for `npx askchokro demo` (v1.1.4).
- `@digitalchokro/askchokro` — Main package (v2.0.4).
- `@digitalchokro/vector-memory` — In-memory vector DB for RAG (v2.0.4).
- `@digitalchokro/microservice` — Dockerized microservice (v1.1.4).
- Architecture Decision Records (ADR 001–004).
- Community health files: CONTRIBUTING, CODE_OF_CONDUCT, SECURITY, LICENSE.
- GitHub Actions CI workflows (lint, typecheck, test, security, e2e, eval, release).
