# @digitalchokro/db-clickhouse

ClickHouse database adapter for **AskChokro**. Enables high-scale real-time analytical reporting and natural language querying across billions of rows of event logs, time-series metrics, and transactional data.

---

## Installation

```bash
pnpm add @digitalchokro/db-clickhouse @clickhouse/client
# or
npm install @digitalchokro/db-clickhouse @clickhouse/client
```

## Quick Start

```typescript
import { AskChokro } from '@digitalchokro/askchokro';
import { ClickHouseAdapter } from '@digitalchokro/db-clickhouse';

const db = new ClickHouseAdapter({
  url: 'http://localhost:8123',
  username: 'default',
  password: 'your-secure-password',
  database: 'analytics',
});

const agent = new AskChokro({
  db,
  provider: 'ollama',
  model: 'qwen2.5:0.5b',
});

const result = await agent.ask('Which 5 endpoints had the highest 95th percentile latency yesterday?');
console.log(result.answer);
```

## Features

- **Blazing Fast OLAP Analytics:** Optimized for multi-gigabyte queries, aggregations, and real-time dashboard generation.
- **Zero Native Dependencies:** Uses `@clickhouse/client` over HTTP/HTTPS, running seamlessly in Node.js, Docker, serverless, and edge containers.
- **Fail-Closed Read-Only Protection:** Rejects unauthorized `INSERT`, `ALTER`, `DROP`, `TRUNCATE`, and `OPTIMIZE` mutations.

## License

MIT © [Digital Chokro](https://digitalchokro.com)
