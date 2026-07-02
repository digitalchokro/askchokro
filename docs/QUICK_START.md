# Quick Start

Get AskChokro up and running in under 5 minutes.

## 1. Installation

Install the core wrapper and the adapter for your framework:

**For Next.js App Router:**
```bash
npm install @digitalchokro/askchokro @digitalchokro/adapter-nextjs
```

**For Express:**
```bash
npm install @digitalchokro/askchokro @digitalchokro/adapter-express
```

## 2. Environment Variables

AskChokro runs in **Zero-Config Mode** by default. It looks for these environment variables:

```bash
# Your Postgres connection string
DATABASE_URL="postgres://user:password@localhost:5432/mydb"

# Your OpenAI API key
OPENAI_API_KEY="sk-..."
```

*(If you don't provide an OpenAI key, AskChokro will automatically attempt to connect to a local Ollama instance running at `http://localhost:11434`!)*

## 3. Create the API Route

### Next.js App Router
Create a new file at `app/api/ask/route.ts`:

```typescript
import { AskChokro } from '@digitalchokro/askchokro';
import { createAskChokroRoute } from '@digitalchokro/adapter-nextjs';

const agent = new AskChokro();

export const POST = createAskChokroRoute(agent);
```

### Express
In your `server.js` or `app.ts`:

```typescript
import express from 'express';
import { AskChokro } from '@digitalchokro/askchokro';
import { createAskChokroMiddleware } from '@digitalchokro/adapter-express';

const app = express();
app.use(express.json());

const agent = new AskChokro();

app.post('/api/ask', createAskChokroMiddleware(agent));

app.listen(3000, () => console.log('Server running!'));
```

## 4. Query from the Frontend

Your backend now exposes a secure AI endpoint. Query it from your frontend:

```javascript
const res = await fetch('/api/ask', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ 
    question: 'How many new users signed up this week?' 
  })
});

const { answer, sql, rows } = await res.json();

console.log(answer); 
// "There were 45 new user signups this week."

console.log(sql);    
// "SELECT COUNT(*) FROM users WHERE created_at >= NOW() - INTERVAL '7 days'"

console.table(rows); 
// [ { count: 45 } ]
```

## Next Steps

- Want to restrict the AI to only a specific tenant's data? Read the [Security Guide](./SECURITY.md) to enable AST rewriting.
- Want to swap OpenAI for local models or use a different database? Read the [Plugins Guide](./PLUGINS.md).
