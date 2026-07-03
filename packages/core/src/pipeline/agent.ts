/**
 * @digitalchokro/core — DatabaseAgent
 *
 * The single public entry point. Orchestrates the full pipeline:
 * schema → prompt → AI → validate → tenant rewrite → execute → format.
 *
 * This class never introspects, generates, or executes directly.
 * Every operation is delegated to the configured interfaces.
 */

import type { AgentConfig, AgentOptions } from '../types/config.js';
import type { TenantContext } from '../types/context.js';
import type { AskResult } from '../types/result.js';
import type { FullSchema } from '../types/schema.js';
import { HooksEmitter, type PipelineHooks } from './hooks.js';
import { AskChokroError } from './errors.js';
import { DefaultSQLValidator } from './sql-validator.js';
import { DefaultTenantScopeRewriter } from './tenant-rewriter.js';

const DEFAULT_OPTIONS: Required<
  Pick<AgentOptions, 'readOnly' | 'maxRows' | 'maxRetries' | 'queryTimeoutMs' | 'schemaCacheTtl' | 'enableFormatting'>
> = {
  readOnly: true,
  maxRows: 200,
  maxRetries: 2,
  queryTimeoutMs: 10_000,
  schemaCacheTtl: 3600,
  enableFormatting: true,
};

export class DatabaseAgent {
  private config: AgentConfig;
  private options: AgentOptions & typeof DEFAULT_OPTIONS;
  private hooks: HooksEmitter;
  private schemaCache: FullSchema | null = null;
  private schemaCacheExpiry = 0;
  private annotations: Record<string, string> = {};

  constructor(config: AgentConfig, hooks?: PipelineHooks) {
    this.validateConfig(config);
    this.config = {
      ...config,
      validator: config.validator ?? new DefaultSQLValidator(),
      tenantRewriter: config.tenantRewriter ?? new DefaultTenantScopeRewriter(),
    };
    this.options = { ...DEFAULT_OPTIONS, ...config.options };
    this.hooks = new HooksEmitter(hooks);
  }

  /**
   * Ask a natural-language question about your database.
   *
   * @param question - The question in plain English (e.g., "How many users signed up last week?")
   * @param context  - Optional tenant/user context for multi-tenant scoping and audit logging.
   * @returns The answer, generated SQL, raw rows, and execution metrics.
   */
  async ask(question: string, context: TenantContext = {}): Promise<AskResult> {
    const startTime = performance.now();
    const totalTokens = { input: 0, output: 0 };
    let retryCount = 0;

    // Validate tenant context if scoping is enabled
    if (this.options.tenantScoping?.enabled && !context.tenantId) {
      throw new AskChokroError(
        'TENANT_ID_MISSING',
        'Tenant scoping is enabled but no tenantId was provided in the context.',
        'Pass a tenantId in the context parameter: agent.ask(question, { tenantId: "..." })',
      );
    }

    // Step 1: Schema introspection (with caching)
    await this.hooks.emit('beforeSchemaRead', context);
    const schema = await this.getSchema();
    await this.hooks.emit('afterSchemaRead', context, schema);

    const maybeModifiedQuestion =
      (await this.hooks.emit('beforePrompt', context, question)) ?? question;

    // Step 2: RAG Vector Search (Optional)
    let ragContext: import('../interfaces/vector-database.js').VectorSearchResult[] = [];
    if (this.config.vectorDb) {
      await this.hooks.emit('beforeVectorSearch', context, question);
      ragContext = await this.config.vectorDb.search(
        typeof maybeModifiedQuestion === 'string' ? maybeModifiedQuestion : question, 
        3, // Top 3 most relevant documents
        context
      );
      await this.hooks.emit('afterVectorSearch', context, ragContext);
    }

    // Step 3: Build the prompt (with relevance selection and RAG docs)
    const promptPayload = this.buildPrompt(
      typeof maybeModifiedQuestion === 'string' ? maybeModifiedQuestion : question,
      schema,
      context,
      ragContext
    );
    await this.hooks.emit('afterPrompt', context, promptPayload.systemPrompt);

    // Steps 3-6: Generate SQL → Validate → Tenant Rewrite → Execute (with retry loop)
    let sql = '';
    let rows: Record<string, unknown>[] = [];

    for (let attempt = 0; attempt <= this.options.maxRetries; attempt++) {
      try {
        // Step 3: Generate SQL
        await this.hooks.emit('beforeGenerateSQL', context, promptPayload.systemPrompt);
        sql = await this.config.ai.generateSQL(
          promptPayload.systemPrompt + '\n\n' + promptPayload.userPrompt,
          promptPayload.relevantSchema,
        );
        const maybeModifiedSQL =
          (await this.hooks.emit('afterGenerateSQL', context, sql)) ?? sql;
        sql = typeof maybeModifiedSQL === 'string' ? maybeModifiedSQL : sql;

        // Step 4: Validate SQL (AST-based)
        this.validateSQL(sql);

        // Step 5: Tenant scope rewrite (AST-level)
        sql = this.applyTenantScoping(sql, context);

        // Step 6: Append LIMIT
        sql = this.appendLimit(sql);

        // Step 7: Execute (or bypass if RAG-only answer is possible)
        if (sql.trim().toUpperCase() === "SELECT 'CANNOT_ANSWER' AS ERROR") {
          this.log('info', 'AI bypassed SQL execution to answer from RAG context');
          rows = []; // No DB rows needed, we will format using RAG context
        } else {
          await this.hooks.emit('beforeExecute', context, sql);
          const result = await this.config.db.execute(sql);
          rows = this.scrubBlockedColumns(result.rows);
          await this.hooks.emit('afterExecute', context, sql, rows);
        }

        // Success — break out of retry loop
        break;
      } catch (error) {
        retryCount = attempt + 1;
        this.log('warn', `Attempt ${retryCount} failed`, { error: String(error) });
        this.emitTelemetry('retry', performance.now() - startTime, { retryCount });

        if (attempt >= this.options.maxRetries) {
          await this.hooks.emit('onError', context, error as Error);
          throw new AskChokroError(
            'MAX_RETRIES_EXCEEDED',
            `Failed after ${this.options.maxRetries + 1} attempts. Last error: ${String(error)}`,
            'Check if your database schema is complex. Try adding schema annotations with agent.annotate() to improve AI accuracy.',
            error as Error,
          );
        }
      }
    }

    // Step 8: Format response (optional)
    let answer: string | null = null;
    let chart: import('../types/result.js').ChartConfig | undefined;

    if (this.options.enableFormatting) {
      const maybeModifiedRows =
        (await this.hooks.emit('beforeResponse', context, rows)) ?? rows;
      const finalRows = Array.isArray(maybeModifiedRows) ? maybeModifiedRows : rows;

      const formatted = await this.config.ai.formatResponse(question, sql, finalRows, ragContext);
      answer = formatted.answer;
      chart = formatted.chart;
    }

    const result: AskResult = {
      answer,
      chart,
      sql,
      rows,
      executionMs: Math.round(performance.now() - startTime),
      tokenUsage: totalTokens,
      retryCount,
    };

    await this.hooks.emit('afterResponse', context, result);
    this.emitTelemetry('response_formatted', performance.now() - startTime);

    return result;
  }

  /**
   * Add human-readable annotations to columns to improve AI accuracy.
   * Example: agent.annotate({ 'orders.status': 'Values: pending, shipped, delivered' })
   */
  annotate(annotations: Record<string, string>): void {
    this.annotations = { ...this.annotations, ...annotations };
  }

  /** Gracefully release all resources. */
  async dispose(): Promise<void> {
    await this.config.db.close();
    await this.config.ai.dispose?.();
  }

  // ─── Private Methods ────────────────────────────────────────────────────────

  private validateConfig(config: AgentConfig): void {
    if (!config.db) {
      throw new AskChokroError(
        'CONFIGURATION_ERROR',
        'A database adapter is required.',
        'Provide a db adapter: new DatabaseAgent({ db: new PostgresAdapter(...), ai: ... })',
      );
    }
    if (!config.ai) {
      throw new AskChokroError(
        'CONFIGURATION_ERROR',
        'An AI provider is required.',
        'Provide an AI provider: new DatabaseAgent({ db: ..., ai: new OllamaProvider(...) })',
      );
    }
  }

  private async getSchema(): Promise<FullSchema> {
    const now = Date.now();
    if (this.schemaCache && now < this.schemaCacheExpiry) {
      this.emitTelemetry('schema_read', 0, { cacheHit: true });
      return this.schemaCache;
    }

    const start = performance.now();
    try {
      let schema: FullSchema;

      if (this.config.schema) {
        schema = await this.config.schema.introspect();
      } else {
        const raw = await this.config.db.introspectSchema();
        schema = this.convertRawSchema(raw);
      }

      // Apply table allow/blocklist BEFORE caching — AI never sees blocked tables
      schema = this.filterSchema(schema);

      // Apply annotations
      schema = this.applyAnnotations(schema);

      this.schemaCache = schema;
      this.schemaCacheExpiry = now + this.options.schemaCacheTtl * 1000;
      this.emitTelemetry('schema_read', performance.now() - start, { cacheHit: false });
      return schema;
    } catch (error) {
      throw new AskChokroError(
        'SCHEMA_INTROSPECTION_FAILED',
        `Failed to read database schema: ${String(error)}`,
        'Verify your database connection string and ensure the user has SELECT privileges on information_schema.',
        error as Error,
      );
    }
  }

  private convertRawSchema(raw: import('../interfaces/db-adapter.js').RawSchemaResult): FullSchema {
    return {
      dialect: this.config.db.dialect,
      tables: raw.tables.map((t) => ({
        name: t.tableName,
        schema: t.tableSchema,
        columns: t.columns.map((c) => ({
          name: c.columnName,
          dataType: c.dataType,
          isNullable: c.isNullable,
          isPrimaryKey: c.isPrimaryKey,
          defaultValue: c.columnDefault,
        })),
        foreignKeys: t.foreignKeys.map((fk) => ({
          column: fk.columnName,
          referencedTable: fk.referencedTable,
          referencedColumn: fk.referencedColumn,
        })),
      })),
      introspectedAt: new Date(),
    };
  }

  private filterSchema(schema: FullSchema): FullSchema {
    let tables = schema.tables;

    if (this.options.allowedTables?.length) {
      const allowed = new Set(this.options.allowedTables.map((t) => t.toLowerCase()));
      tables = tables.filter((t) => allowed.has(t.name.toLowerCase()));
    }

    if (this.options.blockedTables?.length) {
      const blocked = new Set(this.options.blockedTables.map((t) => t.toLowerCase()));
      tables = tables.filter((t) => !blocked.has(t.name.toLowerCase()));
    }

    if (this.options.blockedColumns?.length) {
      const blockedCols = new Set(this.options.blockedColumns.map((c) => c.toLowerCase()));
      tables = tables.map((t) => ({
        ...t,
        columns: t.columns.filter((c) => !blockedCols.has(c.name.toLowerCase())),
      }));
    }

    return { ...schema, tables };
  }

  private applyAnnotations(schema: FullSchema): FullSchema {
    if (Object.keys(this.annotations).length === 0) return schema;

    return {
      ...schema,
      tables: schema.tables.map((table) => ({
        ...table,
        columns: table.columns.map((col) => {
          const key = `${table.name}.${col.name}`;
          const annotation = this.annotations[key];
          return annotation ? { ...col, annotation } : col;
        }),
      })),
    };
  }

  private buildPrompt(
    question: string,
    schema: FullSchema,
    context: TenantContext,
    ragContext?: import('../interfaces/vector-database.js').VectorSearchResult[],
  ): import('../interfaces/providers.js').PromptPayload {
    if (this.config.prompt) {
      return this.config.prompt.build(question, schema, context, this.annotations, ragContext);
    }

    // Default prompt strategy: include all filtered tables (for MVP).
    // Milestone 2 will add relevance-based table selection.
    const schemaText = schema.tables
      .map((t) => {
        const cols = t.columns
          .map((c) => {
            let def = `  ${c.name} ${c.dataType}`;
            if (c.isPrimaryKey) def += ' PRIMARY KEY';
            if (!c.isNullable) def += ' NOT NULL';
            if (c.annotation) def += ` -- ${c.annotation}`;
            return def;
          })
          .join('\n');

        const fks = t.foreignKeys
          .map((fk) => `  FOREIGN KEY (${fk.column}) REFERENCES ${fk.referencedTable}(${fk.referencedColumn})`)
          .join('\n');

        return `TABLE ${t.name} (\n${cols}${fks ? '\n' + fks : ''}\n)`;
      })
      .join('\n\n');

    const tenantNote = this.options.tenantScoping?.enabled
      ? `\n\nIMPORTANT: All queries MUST include a WHERE ${this.options.tenantScoping.column} = [tenant_value] clause on every table that has this column. The current tenant value will be injected automatically — do NOT hardcode it.`
      : '';

    const dialectRules = schema.dialect === 'sqlite' 
      ? `- STRICT SQLITE DIALECT: You MUST use SQLite functions. NEVER use CURDATE(), MONTH(), or YEAR(). Use date('now') and strftime(). Example: strftime('%Y-%m', created_at) = strftime('%Y-%m', 'now').`
      : `- STRICT POSTGRES DIALECT: Use standard Postgres date functions like CURRENT_DATE and date_trunc().`;

    const fewShotExamples = `
EXAMPLES (Learn from these to avoid hallucinating syntax or columns):

**Example 1: Filtering by Real-Life Data**
User: "Who bought a MacBook Pro?"
SQL: SELECT DISTINCT users.name FROM users JOIN orders ON users.id = orders.user_id JOIN order_items ON orders.id = order_items.order_id JOIN products ON order_items.product_id = products.id WHERE products.name = 'MacBook Pro'
*(Note: Use exact strings and appropriate JOINs when dealing with real-world products like 'MacBook Pro', 'Razer Mouse', etc.)*

**Example 2: Date Filtering**
User: "Orders from this month" 
SQL: ${schema.dialect === 'sqlite' ? "SELECT * FROM orders WHERE strftime('%Y-%m', created_at) = strftime('%Y-%m', 'now')" : "SELECT * FROM orders WHERE date_trunc('month', created_at) = date_trunc('month', CURRENT_DATE)"}
*(Note: Use appropriate date functions for the ${schema.dialect} dialect.)*

**Example 3: Aggregation without hallucinating clauses**
User: "Total revenue"
SQL: SELECT SUM(total_amount) FROM orders
*(Note: Do not invent WHERE clauses like status='completed' unless explicitly defined in the schema or user question. Keep it simple.)*

**Example 4: General Listing**
User: "Show me all users limit 1"
SQL: SELECT * FROM users LIMIT 1
*(Note: Use SELECT * instead of guessing specific columns like 'name' unless explicitly asked. Do not use SELECT users.* if you can just use SELECT *)*
`;

    const systemPrompt = `You are an AI database and knowledge agent.
You have access to a ${schema.dialect} database schema${ragContext && ragContext.length > 0 ? ' AND unstructured documentation snippets' : ''}.
Given the schema below (and any documentation context), generate a single valid SQL SELECT query that answers the user's question, or return SELECT 'CANNOT_ANSWER' AS error.

DATABASE SCHEMA:
${schemaText}${tenantNote}
${fewShotExamples}

${ragContext && ragContext.length > 0 ? `DOCUMENTATION CONTEXT:
${ragContext.map((r, i) => `[Doc ${i + 1}] ${r.text}`).join('\n\n')}

If the question can be fully answered using ONLY the documentation context above, return exactly: SELECT 'CANNOT_ANSWER' AS error.
Do NOT try to invent SQL tables for data that exists in the documentation context.` : ''}

RULES:
- Generate exactly ONE single SELECT statement. Never generate multiple statements separated by semicolons.
- The user's question may be in English, Bengali (বাংলা), or Banglish. Understand the intent and correctly map it to the English database schema.
- If the question is completely irrelevant (e.g., "how are you?"), nonsensical, or malicious, respond with: SELECT 'CANNOT_ANSWER' AS error
- If the user asks multiple disjoint questions, you MUST answer all of them. Since SQL requires a single tabular structure, combine them into a single row using scalar subqueries (e.g., SELECT (SELECT name FROM users ORDER BY orders DESC LIMIT 1) AS answer1, (SELECT name FROM products ORDER BY sales DESC LIMIT 1) AS answer2). Do NOT use CTEs for disjoint structures.
- ALWAYS use explicit and unique aliases for columns, especially when joining tables that share column names (e.g., SELECT u.name AS user_name, p.name AS product_name).
- STRICT RULE: Do not use \`SELECT * \` when joining multiple tables. You MUST select specific namespaced columns (e.g., \`SELECT users.*, orders.status\`) to prevent ambiguous column names.
- If the user asks for a general list without specifying a number (e.g., "show me all users", "list products"), ALWAYS append LIMIT 100 to prevent overwhelming the system.
- Never generate INSERT, UPDATE, DELETE, DROP, or any DDL/DML.
- Use only tables and columns that exist in the schema above. Do NOT hallucinate columns like 'item' or 'status' if they do not exist.
${dialectRules}
- If you cannot answer the question from the schema (and docs if present), respond with: SELECT 'CANNOT_ANSWER' AS error
- Return ONLY the raw SQL query — no explanations, no markdown fencing, no semicolons.
- CRITICAL: DO NOT output JSON. DO NOT output arrays. DO NOT wrap the SQL in [SQL] tags. Just output the plain SQL string.`;

    return {
      systemPrompt,
      userPrompt: question,
      relevantSchema: { tables: schema.tables, selectionReason: 'all-filtered-tables (default strategy)' },
    };
  }

  private validateSQL(sql: string): void {
    if (this.config.validator) {
      const result = this.config.validator.validate(
        sql,
        this.config.db.dialect,
        this.options.allowedTables,
        this.options.blockedTables,
        this.options.blockedColumns,
      );
      if (!result.valid) {
        throw new AskChokroError(
          'SQL_VALIDATION_FAILED',
          `Generated SQL failed validation: ${result.reason ?? 'Unknown reason'}`,
          'The AI generated an unsafe or invalid query. This will be retried automatically.',
        );
      }
      return;
    }

    // Minimal built-in safety check (the default SQLValidator package provides the full AST check)
    const upper = sql.toUpperCase().trim();
    const dangerous = ['INSERT', 'UPDATE', 'DELETE', 'DROP', 'TRUNCATE', 'ALTER', 'GRANT', 'REVOKE', 'EXEC'];
    for (const keyword of dangerous) {
      if (upper.startsWith(keyword)) {
        throw new AskChokroError(
          'SQL_VALIDATION_FAILED',
          `Generated SQL starts with a forbidden keyword: ${keyword}`,
          'Install @digitalchokro/core with a proper SQLValidator for AST-based validation.',
        );
      }
    }
  }

  private applyTenantScoping(sql: string, context: TenantContext): string {
    const scoping = this.options.tenantScoping;
    if (!scoping?.enabled || !context.tenantId) return sql;

    if (this.config.tenantRewriter) {
      const result = this.config.tenantRewriter.rewrite(
        sql,
        this.config.db.dialect,
        scoping.column,
        context.tenantId,
        scoping.scopedTables,
      );
      if (!result.success) {
        throw new AskChokroError(
          'TENANT_REWRITE_UNSAFE',
          `Tenant scope rewriter rejected the query: ${result.reason ?? 'Unknown reason'}`,
          'The generated SQL has a shape that cannot be safely scoped to a single tenant. It will be retried automatically.',
        );
      }
      return result.sql!;
    }

    // Without a dedicated rewriter, we cannot safely scope complex queries.
    // Log a warning and let it pass — the README strongly recommends installing the rewriter.
    this.log('warn', 'Tenant scoping is enabled but no TenantScopeRewriter is configured. Complex queries may leak data across tenants.');
    return sql;
  }

  private appendLimit(sql: string): string {
    const upper = sql.toUpperCase();
    if (upper.includes('LIMIT')) return sql;
    
    let cleanSql = sql.trimEnd();
    if (cleanSql.endsWith(';')) {
      cleanSql = cleanSql.slice(0, -1).trimEnd();
    }
    
    return `${cleanSql} LIMIT ${this.options.maxRows}`;
  }

  private scrubBlockedColumns(rows: Record<string, unknown>[]): Record<string, unknown>[] {
    const blocked = this.options.blockedColumns;
    if (!blocked?.length) return rows;

    const blockedSet = new Set(blocked.map((c) => c.toLowerCase()));
    return rows.map((row) => {
      const clean: Record<string, unknown> = {};
      for (const [key, value] of Object.entries(row)) {
        if (!blockedSet.has(key.toLowerCase())) {
          clean[key] = value;
        }
      }
      return clean;
    });
  }

  private log(level: 'debug' | 'info' | 'warn' | 'error', message: string, meta?: Record<string, unknown>): void {
    this.config.logger?.[level](`[AskChokro] ${message}`, meta);
  }

  private emitTelemetry(
    type: import('../interfaces/providers.js').TelemetryEvent['type'],
    durationMs: number,
    extra?: Partial<import('../interfaces/providers.js').TelemetryEvent>,
  ): void {
    this.config.telemetry?.emit({ type, durationMs, ...extra });
  }
}
