# @digitalchokro/db-duckdb

DuckDB database adapter for **AskChokro**. Enables ultra-fast analytical (OLAP) querying on local Parquet, CSV, JSON files, and embedded analytical database tables using natural language.

---

## Installation

```bash
pnpm add @digitalchokro/db-duckdb duckdb
# or
npm install @digitalchokro/db-duckdb duckdb
```

## Quick Start

### In-Memory Analytics

```typescript
import { AskChokro } from '@digitalchokro/askchokro';
import { DuckDBAdapter } from '@digitalchokro/db-duckdb';

const db = new DuckDBAdapter({ path: ':memory:' });

// Create an analytical table
await db.execute(`
  CREATE TABLE transactions AS 
  SELECT * FROM read_csv_auto('sales_data.csv');
`);

const agent = new AskChokro({
  db,
  provider: 'ollama',
  model: 'qwen2.5:0.5b',
});

const result = await agent.ask('What was the total revenue grouped by country last quarter?');
console.log(result.answer);
```

### Direct Parquet & Persistent File Queries

```typescript
import { DuckDBAdapter } from '@digitalchokro/db-duckdb';

// Connect to a persistent DuckDB database file
const db = new DuckDBAdapter({ 
  path: './analytics.duckdb',
  readOnly: true 
});
```

## Features

- **Columnar Performance:** Executes complex analytical aggregations (SUM, AVG, GROUP BY, WINDOW functions) orders of magnitude faster than traditional row-oriented transactional databases.
- **Parquet & CSV Native:** Seamlessly query external datasets without heavy ETL pipelines.
- **Fail-Closed Read-Only Sandbox:** Hardened against SQL mutation injection via strict read-only execution guards.

## License

MIT © [Digital Chokro](https://digitalchokro.com)

