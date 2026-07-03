# AskChokro Roadmap

AskChokro is an evolving open-source project. This roadmap outlines our current goals and future vision for the engine.

## Core Engine
- **Rigorous Eval Harness**: Transition from a simplistic parsing check to a full, execution-based CI evaluation harness to provide transparent and real accuracy numbers across different LLMs.
- **Improved Caching**: Add vector-based semantic caching to avoid redundant LLM calls for similar questions.
- **Streaming Responses**: Support full streaming of LLM generation and database rows.

## Ecosystem & Adapters
- **Fastify & Hono Adapters**: Expand beyond Express and Next.js to fully support modern edge and microservice frameworks.
- **MySQL & SQL Server**: Bring native support for MySQL and Microsoft SQL Server alongside the current PostgreSQL and SQLite implementations.
- **Additional AI Providers**: Integrate native support for Gemini and Google Vertex AI.

## AskChokro WordPress Plugin
We are actively developing an official **AskChokro WordPress Plugin**. This will allow you to drop an AI data assistant directly into your WooCommerce dashboard with zero code. 

**The WordPress Roadmap:**
- **Phase 1:** AskChokro Node.js Microservice (Pre-configured Docker container)
- **Phase 2:** WordPress PHP Plugin (Settings UI & Gutenberg Blocks)
- **Phase 3:** Automatic Tenant Isolation for Multi-Vendor setups

*Read the [Integration Architecture](./docs/INTEGRATION_ARCHITECTURE.md) to learn how this works behind the scenes.*
