<div align="center">
  <img src="https://raw.githubusercontent.com/digitalchokro/askchokro/main/docs/assets/logo.png" width="120" alt="AskChokro Logo" />
  <h1 style="border-bottom: none; margin-bottom: 0;">AskChokro</h1>
  <p><strong>The High-Performance AI Data Engine for Node.js</strong></p>
  <p>Add "Ask your data" to any SaaS app in 10 minutes. Engineered for scale, built for embedding.</p>

  <p>
    <a href="https://www.npmjs.com/package/@digitalchokro/askchokro"><img src="https://img.shields.io/npm/v/@digitalchokro/askchokro.svg?style=for-the-badge&color=252525" alt="npm version" /></a>
    <a href="https://opensource.org/licenses/MIT"><img src="https://img.shields.io/badge/License-MIT-252525.svg?style=for-the-badge" alt="License: MIT" /></a>
    <a href="http://makeapullrequest.com"><img src="https://img.shields.io/badge/PRs-welcome-252525.svg?style=for-the-badge" alt="PRs Welcome" /></a>
  </p>
</div>

<div align="center">
  <em>(Looking for Bengali? <a href="./README-bn.md">Read in Bengali / বাংলায় পড়ুন</a>)</em>
</div>

<br/>
<p align="center">
  <picture>
    <img src="https://raw.githubusercontent.com/digitalchokro/askchokro/main/docs/assets/logo.png" width="800" height="2" style="background: linear-gradient(90deg, transparent, #252525, #8e9eab, #252525, transparent); border-radius: 5px;"/>
  </picture>
</p>
<br/>

## Instantly See It In Action

No templates. No guesswork. Just high-performance engineering out of the box.

```bash
npx @digitalchokro/cli demo
```
This spins up a local SQLite database with sample e-commerce data, auto-detects **Ollama, OpenAI, or Anthropic**, and opens a clean Chat UI on `localhost:3000`.

### Demo Database Schema
The in-memory SQLite database is seeded with a comprehensive e-commerce schema to test complex queries against:
- `users` (id, name, email, country, created_at)
- `products` (id, name, category, price, stock)
- `orders` (id, user_id, total_amount, status, created_at)
- `order_items` (id, order_id, product_id, quantity, price)
- `carts` (id, user_id, created_at)
- `cart_items` (id, cart_id, product_id, quantity)

*Try asking: "Who has items in their cart right now?", "Which category generates the most revenue?", "List all pending orders with amounts", or "Show me products under $100".*

### Anti-Hallucination Fallback (`CANNOT_ANSWER`)
AskChokro's engine uses a strict system prompt. If you ask a question about data that does not exist in the schema, the model will safely reject the prompt and return `CANNOT_ANSWER` instead of hallucinating fake tables or SQL.

> **Note:** AskChokro can intelligently answer multiple disjoint questions in a single prompt by automatically combining them into scalar subqueries, ensuring you get all your answers in a single database round-trip without breaking the SQL driver.

---

## Why AskChokro?

If you've tried building "AI analytics" features into your SaaS, you know the drill:
- **Python wrappers:** You have to deploy a separate Python microservice just to run LangChain or LlamaIndex.
- **Heavy BI tools:** You look at tools like WrenAI or Superset, but they are full platforms. You just want a simple API endpoint to power a chat box in your own React app.
- **Security nightmares:** How do you guarantee the AI doesn't `DROP TABLE` or leak Tenant A's data to Tenant B?

**AskChokro is different:**
1. **100% TypeScript.** Runs right in your Node.js backend (Next.js, Express, Fastify, Hono).
2. **Zero-Config.** Auto-detects credentials for 5 major AI providers: OpenAI, Anthropic, Google Gemini, Google Vertex AI, and local Ollama.
3. **AST-Level Security.** We don't just rely on prompt engineering. We parse the LLM's SQL into an Abstract Syntax Tree (AST), strictly validate it's a read-only `SELECT`, and *automatically rewrite the AST* to enforce tenant scoping.
4. **Enterprise Grade.** Features native Audit Logging, per-tenant Rate Limiting, and multi-tier semantic caching out of the box.

<br/>
<p align="center">
  <picture>
    <img src="https://raw.githubusercontent.com/digitalchokro/askchokro/main/docs/assets/logo.png" width="800" height="1" style="background: linear-gradient(90deg, transparent, #252525, transparent);"/>
  </picture>
</p>
<br/>

## Quick Start (Next.js App Router)

Install the core engine and the Next.js adapter:

```bash
npm install @digitalchokro/askchokro @digitalchokro/adapter-nextjs @digitalchokro/provider-openai @digitalchokro/db-postgres
```

Create a route handler at `app/api/ask/route.ts`:

```typescript
// app/api/ask/route.ts
import { AskChokro } from '@digitalchokro/askchokro';
import { createAskChokroRoute } from '@digitalchokro/adapter-nextjs';

// Auto-detects process.env.DATABASE_URL and process.env.OPENAI_API_KEY
const agent = new AskChokro();

export const POST = createAskChokroRoute(agent);
```

On your frontend:

```javascript
const res = await fetch('/api/ask', {
  method: 'POST',
  body: JSON.stringify({ question: 'Who are my top 5 customers this month?' })
});

const { answer, sql, rows } = await res.json();
console.log(sql);  // "SELECT name, SUM(amount) FROM orders GROUP BY name ORDER BY SUM(amount) DESC LIMIT 5"
console.table(rows);
```

That's it. You just shipped AI data analytics.

## Multi-Tenant Security (AST Rewriting)

When embedding AI in B2B SaaS, tenant isolation is the hardest problem. Naive string-appending (`WHERE tenant_id = X`) fails when the AI generates subqueries or complex `JOIN`s that bypass the filter.

AskChokro uses a sophisticated **AST Scope Rewriter**. 

```typescript
import { DatabaseAgent } from '@digitalchokro/core';
import { PostgresAdapter } from '@digitalchokro/db-postgres';
import { OpenAIProvider } from '@digitalchokro/provider-openai';

const agent = new DatabaseAgent({
  db: new PostgresAdapter({ connectionString: process.env.DATABASE_URL }),
  ai: new OpenAIProvider({ model: 'gpt-4o' }),
  options: {
    tenantScoping: {
      enabled: true,
      column: 'organization_id',
      // Injects the current user's org ID from your request context
      getValue: (ctx) => ctx.orgId, 
    }
  }
});
```

With `tenantScoping` enabled, if the AI generates:
```sql
SELECT o.id, u.email FROM orders o JOIN users u ON o.user_id = u.id
```

AskChokro's AST rewriter physically intercepts the query, parses the syntax tree, and injects your tenant logic into *every* table reference before sending it to the database:
```sql
SELECT o.id, u.email 
FROM orders o 
JOIN users u ON o.user_id = u.id AND u.organization_id = 'org_123'
WHERE o.organization_id = 'org_123'
```

*AskChokro dramatically reduces risk with a fail-closed design. See our [Security Guide](./docs/SECURITY.md) for full details on the 9-layer defense.*

---

## Production-Ready Status

**Latest Release:** `v3.0.0` (July 17, 2026)

**159 Comprehensive Tests** across 12 core packages (~85% code coverage)
- Core engine: 29 tests
- AI providers: 37 tests (OpenAI, Anthropic, Gemini, Ollama)
- Database adapters: 30 tests (PostgreSQL, SQLite, MySQL)
- Web framework adapters: 17 tests (Express, Next.js)
- Microservice: 8 tests with deep health checks

**Feature Complete:**
- SQL generation from natural language
- Multi-database support (PostgreSQL, SQLite, MySQL)
- 4 AI providers with auto-detection
- Web framework adapters (Express, Next.js, Fastify, Hono)
- Tenant scoping with AST rewriting
- SQL injection prevention
- Docker microservice with health checks
- WordPress integration
- RAG with vector memory

**Enterprise Grade:**
- Type-safe TypeScript (strict mode)
- Comprehensive error handling
- Semantic versioning with changesets
- CI/CD automation (GitHub Actions)
- Dependabot for security updates
- Full API documentation
- Architecture & testing guides

**Documentation:**
- [TESTING.md](./docs/TESTING.md) - Testing guide with patterns
- [ARCHITECTURE.md](./docs/ARCHITECTURE.md) - System design deep dive
- [DEPLOYMENT.md](./docs/DEPLOYMENT.md) - Production deployment guide
- [API_REFERENCE.md](./API_REFERENCE.md) - Complete API docs
- [IMPLEMENTATION_REPORT.md](./IMPLEMENTATION_REPORT.md) - Detailed status
- [VALIDATION_CHECKLIST.md](./VALIDATION_CHECKLIST.md) - Quality verification

## Accuracy Benchmarks (In Progress)

We are currently building a rigorous, execution-based evaluation harness to stress-test AskChokro. 

Once the methodology is complete, we will publish the benchmark numbers here, comparing AskChokro's accuracy across different models (GPT-4o, Claude 3.5 Sonnet, Qwen3) on complex JOINs, Aggregations, and Tenant Scoping logic.

---

## Installation & Setup

**Requirements:** Node.js >=18.0.0

### 1. Install Core + Provider + Adapter

```bash
npm install @digitalchokro/askchokro @digitalchokro/provider-openai @digitalchokro/db-postgres
```

Providers available: `@digitalchokro/provider-openai`, `@digitalchokro/provider-anthropic`, `@digitalchokro/provider-gemini`, `@digitalchokro/provider-ollama`

Databases: `@digitalchokro/db-postgres`, `@digitalchokro/db-sqlite`, `@digitalchokro/db-mysql`

Web adapters: `@digitalchokro/adapter-express`, `@digitalchokro/adapter-nextjs`, `@digitalchokro/adapter-fastify`, `@digitalchokro/adapter-hono`

### 2. Set Environment Variables

```bash
# Database
DATABASE_URL=postgresql://user:pass@localhost:5432/mydb

# AI Provider (auto-detected; set one or more)
OPENAI_API_KEY=sk-...
ANTHROPIC_API_KEY=sk-ant-...
GEMINI_API_KEY=...
```

### 3. Use in Your Code

All examples above work out of the box. Environment variables are auto-loaded and auto-detected by the engine.

---

## Supported Providers

| Provider | Model | Environment Variable | Notes |
|----------|-------|----------------------|-------|
| OpenAI | gpt-4o (default) | `OPENAI_API_KEY` | Recommended for accuracy |
| Anthropic | claude-3-5-sonnet | `ANTHROPIC_API_KEY` | Great balance of speed & accuracy |
| Google Gemini | gemini-1.5-pro | `GEMINI_API_KEY` | Fast, good for simple queries |
| Local Ollama | qwen3, llama2, etc. | None (local) | 100% offline, slower |

## Supported Databases

| Database | Driver | Package | Tested |
|----------|--------|---------|--------|
| PostgreSQL | pg | `@digitalchokro/db-postgres` | Yes |
| SQLite | better-sqlite3 | `@digitalchokro/db-sqlite` | Yes |
| MySQL | mysql2/promise | `@digitalchokro/db-mysql` | Yes |
| MSSQL | mssql | `@digitalchokro/db-mssql` | Yes |

---

## Current Limitations

AskChokro is designed to be simple and secure, which means it currently makes some intentional trade-offs:

- **Multi-Part Questions Supported:** AskChokro safely handles disjoint, multi-part questions by mapping them into unified scalar subqueries. However, the root AST must ultimately resolve to a single SQL tabular structure to ensure compatibility across all database drivers.
- **No DML (Mutations):** It is strictly read-only. `INSERT`, `UPDATE`, `DELETE`, and `DROP` are explicitly blocked at the AST level.
- **Complex Aggregations:** While it handles joins and basic aggregations well, extremely complex window functions or recursive CTEs might confuse smaller local models.

---

## Frequently Asked Questions (FAQ)

**Q: Can I use AskChokro in production?**  
A: Yes. AskChokro v3.0.0+ includes 159 production-ready tests with ~85% code coverage, comprehensive error handling, and enterprise security features. It's battle-tested and ready for deployment.

**Q: Is my data secure?**  
A: Yes. AskChokro uses AST-level validation to ensure:
- Only read-only `SELECT` statements are allowed (no mutations)
- SQL injection attacks are impossible (AST parsing, not regex)
- Tenant isolation is enforced at the query level (automatic WHERE injection)
See [Security Guide](./docs/SECURITY.md) for full details.

**Q: What if the AI generates invalid SQL?**  
A: AskChokro's validator will reject it and return a user-friendly error. The engine uses a fail-closed design: invalid queries never reach the database.

**Q: Can I use custom AI models?**  
A: Yes. Implement the `AIProvider` interface and pass it to `new DatabaseAgent()`. See [Plugin Development](./docs/PLUGINS.md) for examples.

**Q: Does it support streaming responses?**  
A: Yes, via `createAskChokroStreamMiddleware()` in the Express and Next.js adapters.

---

## Contributing

We are actively looking for contributors! Check out our [Contributing Guide](CONTRIBUTING.md) and look for issues tagged `good first issue`.

### Development Setup

```bash
# Install pnpm
npm install -g pnpm

# Install dependencies
pnpm install

# Run tests
pnpm test

# Build all packages
pnpm build

# Run linting
pnpm lint

# Type check
pnpm typecheck
```

## License

MIT © Digital Chokro
