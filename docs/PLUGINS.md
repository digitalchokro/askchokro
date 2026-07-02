# Plugin Development Guide

AskChokro is built with a strictly typed plugin architecture. Every core capability—from AI inference to database execution—is defined by an interface. 

If you want to support a new database (like MySQL) or a new AI Provider (like Anthropic Claude), you can easily build and publish your own package!

## Building an AI Provider

To create a new AI provider, implement the `AIProvider` interface from `@digitalchokro/core`.

```typescript
import { AIProvider, RelevantSchema } from '@digitalchokro/core';

export interface MyProviderConfig {
  apiKey: string;
  model?: string;
}

export class MyProvider implements AIProvider {
  constructor(private config: MyProviderConfig) {}

  async generateSQL(prompt: string, schema: RelevantSchema): Promise<string> {
    // 1. Format the schema into a string
    const schemaText = JSON.stringify(schema);
    
    // 2. Build your system instructions
    const systemInstruction = `You are a SQL expert. Output ONLY raw SQL. 
    Schema: ${schemaText}`;

    // 3. Call your AI SDK
    const response = await fetch('https://api.my-ai.com/v1/chat', {
       /* ... */
    });
    
    // 4. Return the raw SQL string
    return response.json().sql;
  }

  async formatResponse(question: string, sql: string, rows: object[]): Promise<string> {
    // Optional: Take the raw rows and ask the AI to summarize them into a natural language sentence.
    return "Your summary here.";
  }
}
```

## Building a Database Adapter

To create a new Database Adapter, implement the `DatabaseAdapter` interface.

```typescript
import { DatabaseAdapter, QueryResult, RawSchemaResult } from '@digitalchokro/core';

export class MySQLAdapter implements DatabaseAdapter {
  readonly dialect = 'mysql';
  readonly name = 'mysql';

  constructor(private connectionString: string) {
    // Initialize DB connection
  }

  async execute(sql: string, params: unknown[] = []): Promise<QueryResult> {
    const start = performance.now();
    
    // Execute query using your MySQL driver
    const rows = await db.query(sql, params);
    
    return {
      rows,
      rowCount: rows.length,
      executionMs: performance.now() - start
    };
  }

  async introspectSchema(): Promise<RawSchemaResult> {
    // Query information_schema to extract tables, columns, and foreign keys
    return { tables: [] }; 
  }

  async close(): Promise<void> {
    // Disconnect from the database
  }
}
```

## Publishing

If you build an adapter for a widely used tool (e.g., Gemini, Anthropic, MySQL, Microsoft SQL Server), please open a PR to add it directly to the AskChokro monorepo!

Alternatively, you can publish it to npm yourself as `askchokro-provider-myai` or `@yourscope/askchokro-db-mytool`.
