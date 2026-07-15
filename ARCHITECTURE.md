# ARCHITECTURE.md - AskChokro Core Architecture

This document explains the internal architecture of AskChokro and how all pieces work together.

## Overview

AskChokro transforms natural language questions into SQL queries and executes them against multiple databases with support for multiple AI providers.

```
User Question
     ↓
[AI Provider] → Natural Language → SQL Query
     ↓
[Database Adapter] → Execute Query
     ↓
Database Results
     ↓
Formatted Response
```

---

## Core Concepts

### 1. The Pipeline

Every request flows through this pipeline:

```typescript
// Simplified pipeline flow
async function askQuestion(question: string): Promise<Answer> {
  // Step 1: Validate question
  const validated = validateInput(question);
  
  // Step 2: Get database schema
  const schema = await database.getSchema();
  
  // Step 3: Generate SQL
  const sql = await aiProvider.generateSQL(question, schema);
  
  // Step 4: Validate SQL (prevent injection)
  const validated = sqlValidator.validate(sql);
  
  // Step 5: Execute query
  const results = await database.query(sql);
  
  // Step 6: Format response
  const answer = formatResponse(results);
  
  return answer;
}
```

### 2. Interfaces

Everything is built on interfaces. This allows pluggable implementations:

```typescript
// packages/core/src/interfaces.ts

export interface DatabaseAdapter {
  getSchema(): Promise<Schema>;
  query(sql: string, params?: unknown[]): Promise<Row[]>;
}

export interface AIProvider {
  generateSQL(question: string, schema: Schema): Promise<string>;
}

export interface SQLValidator {
  validate(sql: string): boolean;
  rewrite(sql: string, options: RewriteOptions): string;
}
```

---

## Directory Structure

```
packages/
├── core/                          # Core interfaces & engine
│   ├── src/
│   │   ├── interfaces.ts          # AIProvider, DatabaseAdapter, SQLValidator
│   │   ├── types.ts               # Schema, Request, Response types
│   │   ├── validator.ts           # SQL validation (AST-based)
│   │   ├── error.ts               # AskChokroError class
│   │   └── index.ts               # Main exports
│   └── package.json
│
├── askchokro/                     # Main engine (ties everything together)
│   ├── src/
│   │   ├── index.ts               # AskChokro class (orchestrates pipeline)
│   │   ├── demo.ts                # Demo/example usage
│   │   └── __tests__/             # Tests
│   └── package.json
│
├── adapter-express/               # Express.js middleware
├── adapter-nextjs/                # Next.js App Router handler
│
├── db-postgres/                   # PostgreSQL adapter
├── db-sqlite/                     # SQLite adapter
├── db-mysql/                      # MySQL adapter
│
├── provider-openai/               # OpenAI provider
├── provider-ollama/               # Ollama provider
├── provider-anthropic/            # Anthropic provider
├── provider-gemini/               # Google Gemini provider
│
└── cli/                           # CLI tool (`npx askchokro`)
```

---

## Layer 1: Core Engine (@digitalchokro/core)

### Purpose
Define contracts and validation logic that all implementations must follow.

### Key Files

#### interfaces.ts
```typescript
export interface DatabaseAdapter {
  getSchema(): Promise<Schema>;
  query(sql: string): Promise<Row[]>;
}

export interface AIProvider {
  generateSQL(question: string, schema: Schema): Promise<string>;
}

export interface SQLValidator {
  validate(sql: string): boolean;
}
```

#### types.ts
```typescript
export interface Schema {
  [tableName: string]: {
    columns: {
      name: string;
      type: ColumnType;
      nullable: boolean;
      primaryKey: boolean;
      references?: {
        table: string;
        column: string;
      };
    }[];
  };
}

export interface Request {
  question: string;
  tenantId?: string;
}

export interface Response {
  answer: string;
  sql: string;
  results: Row[];
  executionTime: number;
}
```

#### validator.ts
Uses **Abstract Syntax Tree (AST)** parsing instead of regex:

```typescript
// Why AST? It understands SQL semantics
// Regex can be fooled by string literals

function validate(sql: string): boolean {
  const ast = parse(sql);
  
  // Check: only SELECT queries (no INSERT, DELETE, DROP)
  if (ast.type !== 'SELECT') throw new Error('Only SELECT allowed');
  
  // Check: no cross-database queries
  if (ast.tables.some(t => t.database !== null)) {
    throw new Error('Cross-database queries not allowed');
  }
  
  return true;
}
```

---

## Layer 2: Main Engine (@digitalchokro/askchokro)

### Purpose
Orchestrate the pipeline and tie core + providers + adapters together.

### AskChokro Class

```typescript
export class AskChokro {
  private provider: AIProvider;
  private database: DatabaseAdapter;
  private validator: SQLValidator;

  constructor(config: {
    provider: AIProvider;
    database: DatabaseAdapter;
  }) {
    this.provider = config.provider;
    this.database = config.database;
    this.validator = new SQLValidator();
  }

  async ask(question: string): Promise<Response> {
    try {
      // 1. Get schema
      const schema = await this.database.getSchema();
      
      // 2. Generate SQL
      const sql = await this.provider.generateSQL(question, schema);
      
      // 3. Validate SQL
      this.validator.validate(sql);
      
      // 4. Execute
      const startTime = Date.now();
      const results = await this.database.query(sql);
      const executionTime = Date.now() - startTime;
      
      // 5. Format response
      return {
        answer: this.formatAnswer(results),
        sql,
        results,
        executionTime
      };
    } catch (error) {
      throw new AskChokroError(error.message);
    }
  }
}
```

---

## Layer 3: Adapters & Providers

### Database Adapters

Each adapter implements `DatabaseAdapter` interface:

#### PostgreSQL Example
```typescript
export class PostgresAdapter implements DatabaseAdapter {
  private pool: Pool;

  async getSchema(): Promise<Schema> {
    const tables = await this.pool.query(`
      SELECT table_name 
      FROM information_schema.tables
    `);
    
    return {
      [table.table_name]: {
        columns: await this.getColumns(table.table_name)
      }
    };
  }

  async query(sql: string): Promise<Row[]> {
    return this.pool.query(sql);
  }
}
```

#### SQLite Example
```typescript
export class SqliteAdapter implements DatabaseAdapter {
  private db: Database;

  async getSchema(): Promise<Schema> {
    const tables = this.db.exec(
      "SELECT name FROM sqlite_master WHERE type='table'"
    );
    // ... same pattern
  }

  async query(sql: string): Promise<Row[]> {
    return this.db.prepare(sql).all();
  }
}
```

### AI Providers

Each provider implements `AIProvider` interface:

#### OpenAI Example
```typescript
export class OpenAIProvider implements AIProvider {
  private client: OpenAI;

  async generateSQL(
    question: string,
    schema: Schema
  ): Promise<string> {
    const response = await this.client.chat.completions.create({
      model: 'gpt-4',
      messages: [
        {
          role: 'system',
          content: `You are a SQL expert. Convert questions to SQL.
Database schema:
${JSON.stringify(schema, null, 2)}`
        },
        {
          role: 'user',
          content: question
        }
      ]
    });

    return response.choices[0].message.content;
  }
}
```

#### Ollama Example
```typescript
export class OllamaProvider implements AIProvider {
  async generateSQL(
    question: string,
    schema: Schema
  ): Promise<string> {
    const response = await fetch('http://localhost:11434/api/generate', {
      method: 'POST',
      body: JSON.stringify({
        model: 'llama2',
        prompt: `Convert to SQL: ${question}\n\nSchema: ${JSON.stringify(schema)}`,
        stream: false
      })
    });

    const data = await response.json();
    return this.extractSQL(data.response);
  }
}
```

---

## Layer 4: Web Framework Adapters

These are middleware for Express, Next.js, etc.

### Express Adapter

```typescript
export class ExpressAdapter {
  private chokro: AskChokro;

  middleware() {
    return async (req: Request, res: Response) => {
      try {
        const question = req.query.question as string;
        
        if (!question) {
          return res.status(400).json({ error: 'Missing question' });
        }

        const response = await this.chokro.ask(question);
        res.json(response);
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    };
  }
}
```

### Next.js Adapter

```typescript
export async function POST(request: NextRequest) {
  const { question } = await request.json();
  
  try {
    const response = await chokro.ask(question);
    return NextResponse.json(response);
  } catch (error) {
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}
```

---

## Security: SQL Injection Prevention

### AST-Based Validation (ADR-002)

Instead of regex patterns, AskChokro uses Abstract Syntax Trees:

```typescript
// The validator parses SQL into an AST
// Then validates at the semantic level

const sql = `SELECT * FROM users WHERE id = '1' OR '1'='1'`;

// Parse into AST
const ast = parse(sql);

// Result:
// {
//   type: 'SELECT',
//   from: 'users',
//   where: {
//     left: { column: 'id', value: '1' },
//     operator: 'OR',
//     right: { value: '1', equals: '1' }
//   }
// }

// The AST is inspected, not the raw string
// String literals are properly distinguished
```

### Tenant Isolation (ADR-003)

```typescript
// If question includes tenant context,
// the validator automatically adds WHERE clause

const question = "Show products for tenant #5";

// Validator rewrites:
// FROM: SELECT * FROM products
// TO:   SELECT * FROM products WHERE tenant_id = 5

// This is done at AST level, preventing:
// - Tenant ID leakage
// - UNION attacks
// - Subquery injection
```

---

## Data Flow Example

### Request: "How many active users in the last 30 days?"

```
1. Request arrives at adapter
   question = "How many active users in the last 30 days?"

2. Ask engine gets schema
   schema = {
     users: { columns: [id, name, created_at, is_active] },
     ...
   }

3. Ask AI provider for SQL
   AI suggests: SELECT COUNT(*) FROM users 
               WHERE is_active = true 
               AND created_at > NOW() - '30 days'

4. Validate SQL
   ✓ Only SELECT query
   ✓ No cross-database
   ✓ No system tables
   ✓ All columns exist in schema

5. Execute query
   results = [{ COUNT(*): 1542 }]

6. Format response
   answer = "There are 1,542 active users in the last 30 days"

7. Return response
   {
     answer: "There are 1,542 active users...",
     sql: "SELECT COUNT(*) FROM users ...",
     results: [{ COUNT(*): 1542 }],
     executionTime: 42
   }
```

---

## Error Handling

All errors inherit from `AskChokroError`:

```typescript
export class AskChokroError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly statusCode: number = 500
  ) {
    super(message);
  }
}

// Usage
throw new AskChokroError(
  'Invalid SQL query detected',
  'INVALID_SQL',
  400
);
```

---

## Configuration

### Environment Variables

```bash
# AI Provider
OPENAI_API_KEY=sk-...
ANTHROPIC_API_KEY=...
OLLAMA_BASE_URL=http://localhost:11434

# Database
DATABASE_URL=postgresql://user:pass@localhost/db
DATABASE_TYPE=postgres

# Logging
LOG_LEVEL=info
```

### Initialization

```typescript
const chokro = new AskChokro({
  provider: process.env.PROVIDER === 'openai' 
    ? new OpenAIProvider({ apiKey: process.env.OPENAI_API_KEY })
    : new OllamaProvider({ baseURL: process.env.OLLAMA_BASE_URL }),
  
  database: process.env.DATABASE_TYPE === 'postgres'
    ? new PostgresAdapter({ connectionString: process.env.DATABASE_URL })
    : new SqliteAdapter({ filePath: './data.db' })
});
```

---

## Performance Considerations

### Caching Opportunities

1. **Schema Caching** — Database schema rarely changes
   - Cache for 1 hour per database
   - Invalidate on schema change notification

2. **Semantic Caching** — Reuse answers for similar questions
   - Use vector similarity (@digitalchokro/vector-memory)
   - Cache for 24 hours

3. **Query Result Caching** — Reuse exact results
   - Cache for 5 minutes by default
   - Configurable per table

### Query Optimization

```typescript
// Bad: Cartesian product
SELECT * FROM users, orders

// Good: Explicit join
SELECT users.*, orders.*
FROM users
INNER JOIN orders ON users.id = orders.user_id
```

---

## Extending AskChokro

### Adding a New Database

1. Create package: `packages/db-yourdb/`
2. Implement `DatabaseAdapter` interface
3. Add tests
4. Add to monorepo: update `pnpm-workspace.yaml`

### Adding a New AI Provider

1. Create package: `packages/provider-yourprovider/`
2. Implement `AIProvider` interface
3. Handle authentication
4. Add error handling
5. Add tests

### Adding a New Web Framework

1. Create package: `packages/adapter-yourframework/`
2. Implement request → response flow
3. Use existing AskChokro engine
4. Add error handling
5. Add tests

---

## Testing Architecture

### Unit Tests
- Test individual adapters with mocked dependencies
- Test providers with mocked API responses
- Test validators with various SQL inputs

### Integration Tests
- Test full pipeline with real database (Docker)
- Test full pipeline with real AI provider (mocked)

### End-to-End Tests
- Test complete workflows across multiple packages
- Test CLI tool execution
- Test example projects

---

## Future Enhancements

### Short Term (v3.0)
- Streaming responses (chunk results as they arrive)
- Semantic caching (vector-based query deduplication)
- Query result caching (configurable TTL)

### Medium Term
- Row-level security per tenant
- Query logging and audit trail
- Rate limiting per user/tenant

### Long Term
- Distributed caching (Redis support)
- Real-time data streaming
- Multi-model ensemble (combine multiple LLMs)

---

## References

- [Architecture Decision Records](./docs/adr/) — Design decisions
- [TESTING.md](./TESTING.md) — How to write tests
- [TEST_COVERAGE_ROADMAP.md](./TEST_COVERAGE_ROADMAP.md) — What needs testing
- [Individual Package READMEs](./packages/) — Specific implementation details
