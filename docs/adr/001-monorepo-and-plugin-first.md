# ADR 001: Monorepo and Plugin-First Architecture

## Status
Accepted

## Context
AskChokro needs to support multiple database dialects, multiple AI providers, and multiple web framework integrations. A monolithic package would force every consumer to install all drivers and SDKs regardless of what they actually use.

## Decision
We use a pnpm workspace monorepo orchestrated by Turborepo. Each database adapter, AI provider, and framework integration is its own independently installable package under the `@digitalchokro` npm scope.

`@digitalchokro/core` has **zero** runtime npm dependencies. Database drivers and AI SDKs are peer dependencies of their respective adapter packages.

## Consequences
- Consumers install only what they need: `@digitalchokro/core` + `@digitalchokro/db-postgres` + `@digitalchokro/provider-ollama`.
- Community contributors can add new adapters without touching core logic.
- "Good first issues" naturally emerge: "Add MySQL adapter", "Add Gemini provider".
- Trade-off: more packages to maintain and version. Mitigated by Turborepo's parallel build and changeset-based publishing.
