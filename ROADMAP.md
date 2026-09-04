# AskChokro Roadmap

AskChokro is an evolving open-source project. This roadmap outlines what already ships and where the engine is going next.

## Already Shipped

These were on earlier versions of this roadmap and are now in the repository:

- **Execution-based Eval Harness** — `eval/` runs every question against a seeded Postgres instance and compares real result sets, instead of inspecting the generated SQL string. Reports are produced as JSON and HTML, and CI gates PRs on a stratified sample of the dataset.
- **Semantic Caching** — a three-tier cache (exact match, vector-based semantic match, result cache) avoids redundant LLM calls for similar questions.
- **Fastify & Hono Adapters** — `@digitalchokro/adapter-fastify` and `@digitalchokro/adapter-hono`, alongside Express and Next.js.
- **MySQL & SQL Server** — `@digitalchokro/db-mysql` and `@digitalchokro/db-mssql`, alongside PostgreSQL and SQLite.
- **Gemini & Vertex AI Providers** — `@digitalchokro/provider-gemini` and `@digitalchokro/provider-vertex`, plus `@digitalchokro/provider-groq` for LPU inference.
- **WordPress Plugin** — `packages/wordpress-plugin`, with a settings UI, a Gutenberg block, a shortcode, and JWT-signed requests to the microservice.
- **Streaming Responses** — all six providers implement `streamResponse`, `DatabaseAgent.stream()` yields the answer token-by-token, and the Express, Next.js and Fastify adapters expose it over Server-Sent Events.

## In Progress

- **Streaming the Rest of the Way**: `DatabaseAgent.stream()` runs the whole pipeline before the first chunk, so rows still arrive in one block in the final `metadata` chunk. Incremental row streaming, and an SSE route for the Hono adapter, are both outstanding.
- **Coverage Reporting**: the test suites are in CI, but line-coverage collection and a published coverage number are not wired up yet.

## Next

### Core Engine
- **Broader Eval Coverage**: grow the 92-pair dataset, and publish per-provider accuracy from scheduled runs rather than manual ones, so the numbers in the README become a per-commit measurement.
- **Query Cost Guards**: reject or rewrite queries whose estimated plan cost exceeds a budget, using `EXPLAIN` before execution.
- **Window Functions & CTE Hardening**: extend the tenant rewriter's test matrix over recursive CTEs and window frames.

### Ecosystem & Adapters
- **Additional Databases**: native support for ClickHouse and BigQuery for analytics-scale workloads.
- **Additional AI Providers**: AWS Bedrock, and OpenAI-compatible gateways (vLLM, LiteLLM, OpenRouter).
- **Charting**: richer `ChartConfig` inference so results can be rendered without a second model call.

## AskChokro WordPress Plugin

The official **AskChokro WordPress Plugin** lives in `packages/wordpress-plugin` and drops an AI data assistant into a WooCommerce dashboard with no code.

**Status:**
- **Phase 1 — Done:** AskChokro Node.js microservice (`packages/microservice`, with a pre-configured Docker container).
- **Phase 2 — Done:** WordPress PHP plugin with a settings UI, a Gutenberg block, and a shortcode.
- **Phase 3 — Next:** automatic tenant isolation for multi-vendor setups.

*Read the [Integration Architecture](./docs/INTEGRATION_ARCHITECTURE.md) to learn how this works behind the scenes.*
