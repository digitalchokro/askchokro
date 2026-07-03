<div align="center">
  <img src="https://raw.githubusercontent.com/digitalchokro/askchokro/main/docs/assets/logo.png" width="120" alt="AskChokro Logo" />
  <h1>AskChokro</h1>
  <p><strong>The AI Data Engine for Node.js</strong></p>
  <p>Add "Ask your data" to any SaaS app in 10 minutes. Simpler by design, built for embedding.</p>
  
  [![npm version](https://img.shields.io/npm/v/@digitalchokro/askchokro.svg?style=flat-square)](https://www.npmjs.com/package/@digitalchokro/askchokro)
  [![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg?style=flat-square)](https://opensource.org/licenses/MIT)
  [![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg?style=flat-square)](http://makeapullrequest.com)
</div>

<div align="center">
  <em>(Looking for Bengali? <a href="./README-bn.md">Read in Bengali / বাংলায় পড়ুন</a>)</em>
</div>
<br/>
<p align="center">
  <picture>
    <img src="https://raw.githubusercontent.com/digitalchokro/askchokro/main/docs/assets/logo.png" width="800" height="2" style="background: linear-gradient(90deg, transparent, #8e9eab, #eef2f3, #8e9eab, transparent); border-radius: 5px;"/>
  </picture>
</p>
<br/>

## Instantly see it in action

No setup, no accounts, just a terminal.

```bash
npx @digitalchokro/cli demo
```
This spins up a local SQLite database with sample e-commerce data, auto-detects **Ollama, OpenAI, or Anthropic**, and opens a beautiful Chat UI on `localhost:3000`.

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

### Using Local Models (Ollama)
If you want to force a specific provider or model, use environment variables:

```bash
# Force Ollama with a specific model (ignores any API keys in your environment)
ASKCHOKRO_PROVIDER=ollama ASKCHOKRO_MODEL=qwen3 npx @digitalchokro/cli demo

# Force Anthropic
ASKCHOKRO_PROVIDER=anthropic ANTHROPIC_API_KEY=sk-ant-... npx @digitalchokro/cli demo
```

---

## Why AskChokro?

If you've tried building "AI analytics" features into your SaaS, you know the drill:
- **Python wrappers:** You have to deploy a separate Python microservice just to run LangChain or LlamaIndex.
- **Heavy BI tools:** You look at tools like WrenAI or Superset, but they are full platforms. You just want a simple API endpoint to power a chat box in your own React app.
- **Security nightmares:** How do you guarantee the AI doesn't `DROP TABLE` or leak Tenant A's data to Tenant B?

**AskChokro is different:**
1. **100% TypeScript.** Runs right in your Node.js backend (Next.js, Express, Fastify).
2. **Zero-Config.** The `AskChokro` wrapper auto-detects `DATABASE_URL`, `OPENAI_API_KEY`, and `ANTHROPIC_API_KEY` - and falls back to a local Ollama instance seamlessly when no keys are found.
3. **AST-Level Security.** We don't just rely on prompt engineering. We parse the LLM's SQL into an Abstract Syntax Tree (AST), strictly validate it's a read-only `SELECT`, and *automatically rewrite the AST* to enforce tenant scoping before executing it.

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

## Accuracy Benchmarks (In Progress)

We are currently building a rigorous, execution-based evaluation harness to stress-test AskChokro. 

Once the methodology is complete, we will publish the benchmark numbers here, comparing AskChokro's accuracy across different models (GPT-4o, Claude 3.5 Sonnet, Qwen3) on complex JOINs, Aggregations, and Tenant Scoping logic.
## Current Limitations

AskChokro is designed to be simple and secure, which means it currently makes some intentional trade-offs:
- **Multi-Part Questions Supported:** AskChokro safely handles disjoint, multi-part questions by mapping them into unified scalar subqueries. However, the root AST must ultimately resolve to a single SQL tabular structure to ensure compatibility across all database drivers.
- **No DML (Mutations):** It is strictly read-only. `INSERT`, `UPDATE`, `DELETE`, and `DROP` are explicitly blocked at the AST level.
- **Complex Aggregations:** While it handles joins and basic aggregations well, extremely complex window functions or recursive CTEs might confuse smaller local models.


## Frequently Asked Questions (FAQ)



## Documentation

- [Quick Start](./docs/QUICK_START.md) - Full 5-minute integration guide.
- [Security Model](./docs/SECURITY.md) - Deep dive into AST validation, column masking, and read-only sandboxes.
- [Plugin Development](./docs/PLUGINS.md) - Learn how to build your own `AIProvider` or `DatabaseAdapter`.
- [Integration Architecture](/docs/INTEGRATION_ARCHITECTURE.md) - Learn how to embed AskChokro across platforms.

## Contributing

We are actively looking for contributors! Check out our [Contributing Guide](CONTRIBUTING.md) and look for issues tagged `good first issue`.

If you want to add support for MySQL, Gemini, Google Vertex, or Fastify, we have automated templates waiting for you.

## License

MIT © Digital Chokro
