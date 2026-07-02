<div align="center">
  <img src="https://raw.githubusercontent.com/digitalchokro/askchokro/main/docs/assets/logo.png" width="120" alt="AskChokro Logo" />
  <h1>AskChokro</h1>
  <p><strong>The AI Data Engine for Node.js</strong></p>
  <p>Add "Ask your data" to any SaaS app in 10 minutes. Simpler by design, built for embedding.</p>
  
  [![npm version](https://img.shields.io/npm/v/askchokro.svg?style=flat-square)](https://www.npmjs.com/package/askchokro)
  [![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg?style=flat-square)](https://opensource.org/licenses/MIT)
  [![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg?style=flat-square)](http://makeapullrequest.com)
</div>

<hr/>

## Instantly see it in action

No setup, no accounts, just a terminal.

```bash
npx askchokro demo
```
This spins up a local SQLite database with sample e-commerce data, auto-detects Ollama or OpenAI, and opens a beautiful Chat UI on `localhost:3000`.

---

## Why AskChokro?

If you've tried building "AI analytics" features into your SaaS, you know the drill:
- **Python wrappers:** You have to deploy a separate Python microservice just to run LangChain or LlamaIndex.
- **Heavy BI tools:** You look at tools like WrenAI or Superset, but they are full platforms. You just want a simple API endpoint to power a chat box in your own React app.
- **Security nightmares:** How do you guarantee the AI doesn't `DROP TABLE` or leak Tenant A's data to Tenant B?

**AskChokro is different:**
1. **100% TypeScript.** Runs right in your Node.js backend (Next.js, Express, Fastify).
2. **Zero-Config.** The `AskChokro` wrapper auto-detects `DATABASE_URL` and `OPENAI_API_KEY`, but falls back to local SQLite and Ollama seamlessly.
3. **AST-Level Security.** We don't just rely on prompt engineering. We parse the LLM's SQL into an Abstract Syntax Tree (AST), strictly validate it's a read-only `SELECT`, and *automatically rewrite the AST* to enforce tenant scoping before executing it.

## Quick Start (Next.js App Router)

Install the core engine and the Next.js adapter:

```bash
npm install askchokro @askchokro/adapter-nextjs
```

Create a route handler at `app/api/ask/route.ts`:

```typescript
// app/api/ask/route.ts
import { AskChokro } from 'askchokro';
import { createAskChokroRoute } from '@askchokro/adapter-nextjs';

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
import { DatabaseAgent } from '@askchokro/core';
import { PostgresAdapter } from '@askchokro/db-postgres';
import { OpenAIProvider } from '@askchokro/provider-openai';

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

## Documentation

- [Quick Start](./docs/QUICK_START.md) - Full 5-minute integration guide.
- [Security Model](./docs/SECURITY.md) - Deep dive into AST validation, column masking, and read-only sandboxes.
- [Plugin Development](./docs/PLUGINS.md) - Learn how to build your own `AIProvider` or `DatabaseAdapter`.

## Contributing

We are actively looking for contributors! Check out our [Contributing Guide](CONTRIBUTING.md) and look for issues tagged `good first issue`.

If you want to add support for MySQL, Gemini, Anthropic, or Fastify, we have automated templates waiting for you.

## License

MIT © Digital Chokro
