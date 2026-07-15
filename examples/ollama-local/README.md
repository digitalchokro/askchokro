# AskChokro with Local Ollama

This example demonstrates how to use AskChokro with a locally-running Ollama instance for **100% offline operation** with no external API costs.

## Prerequisites

- [Ollama](https://ollama.ai) installed and running
- Node.js >= 18
- pnpm >= 9

## Setup

### 1. Start Ollama

```bash
# Start Ollama server (default: http://localhost:11434)
ollama serve

# In a separate terminal, pull a model
ollama pull llama2
# or try: ollama pull neural-chat, ollama pull mistral, ollama pull orca-mini
```

### 2. Create Project

```bash
mkdir my-ollama-app
cd my-ollama-app
npm init -y
npm install @digitalchokro/askchokro @digitalchokro/adapter-express @digitalchokro/provider-ollama @digitalchokro/db-sqlite express
```

### 3. Create Sample Database

Create `database.sql`:
```sql
CREATE TABLE products (
  id INTEGER PRIMARY KEY,
  name TEXT,
  price REAL,
  category TEXT
);

INSERT INTO products (name, price, category) VALUES
  ('Laptop', 999.99, 'Electronics'),
  ('Mouse', 29.99, 'Electronics'),
  ('Coffee', 5.99, 'Beverages'),
  ('T-Shirt', 19.99, 'Clothing');
```

### 4. Start the App

Create `index.ts`:
```typescript
import express from "express";
import { AskChokro } from "@digitalchokro/askchokro";
import { ExpressAdapter } from "@digitalchokro/adapter-express";
import { OllamaProvider } from "@digitalchokro/provider-ollama";
import { SqliteAdapter } from "@digitalchokro/db-sqlite";

const app = express();
const chokro = new AskChokro({
  provider: new OllamaProvider({ modelName: "llama2" }),
  database: new SqliteAdapter({ filePath: "./data.db" }),
});

app.use(
  "/ask",
  new ExpressAdapter(chokro).middleware()
);

app.listen(3000, () => {
  console.log("AskChokro running at http://localhost:3000");
  console.log("Try: http://localhost:3000/ask?question=what+products+do+you+have");
});
```

Run:
```bash
npx ts-node index.ts
```

### 5. Try It

```bash
curl "http://localhost:3000/ask?question=what+products+do+you+have"
curl "http://localhost:3000/ask?question=which+products+are+under+30+dollars"
```

## Configuration

### Ollama Models

Popular open-source models:
- **llama2** (7B) — Balanced performance/speed
- **mistral** (7B) — Fast, good quality
- **neural-chat** (7B) — Optimized for conversation
- **orca-mini** (3B) — Lightweight, suitable for CPU-only
- **dolphin-mixtral** (47B) — Powerful (needs GPU)

### Custom Ollama Endpoint

```typescript
new OllamaProvider({
  modelName: "llama2",
  baseURL: "http://192.168.1.100:11434", // Remote Ollama
})
```

## Troubleshooting

**Q: "connect ECONNREFUSED 127.0.0.1:11434"**  
A: Make sure Ollama is running. Start with `ollama serve` in another terminal.

**Q: Very slow responses**  
A: You're likely using a CPU-only setup. Try a smaller model like `orca-mini` or get a GPU (NVIDIA CUDA recommended).

**Q: Model not found**  
A: Pull it first: `ollama pull neural-chat`

## Learn More

- [Ollama Documentation](https://github.com/ollama/ollama)
- [AskChokro Documentation](../../README.md)
- [OllamaProvider API](../../packages/provider-ollama/README.md)
