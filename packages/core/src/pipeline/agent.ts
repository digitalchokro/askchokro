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
/* eslint-disable @typescript-eslint/unbound-method */
import { AskChokroError } from './errors.js';
import { DefaultSQLValidator } from './sql-validator.js';
import { DefaultTenantScopeRewriter } from './tenant-rewriter.js';
import { InMemoryCacheProvider } from '../providers/memory-cache.js';

const DEFAULT_OPTIONS: Required<
  Pick<AgentOptions, 'readOnly' | 'maxRows' | 'maxRetries' | 'queryTimeoutMs' | 'schemaCacheTtl' | 'enableFormatting' | 'enableCaching' | 'semanticCacheThreshold' | 'queryResultCacheTtl'>
> = {
  readOnly: true,
  maxRows: 200,
  maxRetries: 2,
  queryTimeoutMs: 10_000,
  schemaCacheTtl: 3600,
  enableFormatting: true,
  enableCaching: true,
  semanticCacheThreshold: 0.95,
  queryResultCacheTtl: 300,
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
      cache: config.cache ?? new InMemoryCacheProvider(),
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
    const { sql, rows, ragContext, retryCount, startTime, totalTokens } = await this.executePipeline(question, context);

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
   * Ask a natural-language question and stream the answer back.
   *
   * @param question - The question in plain English
   * @param context  - Optional tenant/user context
   * @returns An AsyncIterable of stream chunks, ending with metadata.
   */
  async *stream(question: string, context: TenantContext = {}): AsyncIterable<{
    content?: string;
    chart?: import('../types/result.js').ChartConfig;
    done?: boolean;
    metadata?: Omit<AskResult, 'answer' | 'chart'>;
  }> {
    const { sql, rows, ragContext, retryCount, startTime, totalTokens } = await this.executePipeline(question, context);

    let finalRows = rows;
    if (this.options.enableFormatting) {
      const maybeModifiedRows =
        (await this.hooks.emit('beforeResponse', context, rows)) ?? rows;
      finalRows = Array.isArray(maybeModifiedRows) ? maybeModifiedRows : rows;

      if (this.config.ai.streamResponse) {
        for await (const chunk of this.config.ai.streamResponse(question, sql, finalRows, ragContext)) {
          yield chunk;
        }
      } else {
        // Graceful fallback to block formatting
        const formatted = await this.config.ai.formatResponse(question, sql, finalRows, ragContext);
        if (formatted.answer) yield { content: formatted.answer };
        if (formatted.chart) yield { chart: formatted.chart };
      }
    }

    const metadata: Omit<AskResult, 'answer' | 'chart'> = {
      sql,
      rows,
      executionMs: Math.round(performance.now() - startTime),
      tokenUsage: totalTokens,
      retryCount,
    };

    yield { done: true, metadata };
  }

  private async executePipeline(
    question: string,
    context: TenantContext
  ): Promise<{
    sql: string;
    rows: Record<string, unknown>[];
    ragContext?: import('../interfaces/vector-database.js').VectorSearchResult[];
    retryCount: number;
    startTime: number;
    totalTokens: { input: number; output: number };
  }> {
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

    // Step -1: IP Whitelist Validation
    if (this.options.ipWhitelist?.enabled) {
      if (!context.ip) {
        throw new AskChokroError(
          'IP_WHITELIST_BLOCKED',
          'IP Whitelist is enabled but no IP was provided in the context.',
          'Ensure your framework adapter extracts the client IP address.',
        );
      }
      if (!this.options.ipWhitelist.allowedIps.includes(context.ip)) {
        throw new AskChokroError(
          'IP_WHITELIST_BLOCKED',
          `Access denied from IP: ${context.ip}`,
          'Update the IP Whitelist configuration to allow this IP.',
        );
      }
    }

    // Step 0: Rate Limiting
    if (this.options.rateLimit?.enabled && this.config.cache) {
      const rlKey = `rate-limit:${context.tenantId ?? 'global'}`;
      const currentCount = await this.config.cache.get<number>(rlKey) ?? 0;
      
      if (currentCount >= this.options.rateLimit.maxRequests) {
        throw new AskChokroError(
          'RATE_LIMIT_EXCEEDED',
          `Rate limit exceeded for tenant ${context.tenantId ?? 'global'}. Allowed: ${this.options.rateLimit.maxRequests} per window.`,
          'Please slow down or upgrade your plan.',
        );
      }
      
      await this.config.cache.set(rlKey, currentCount + 1, this.options.rateLimit.windowSeconds);
    }

    // Step 1: Schema introspection (with caching)
    await this.hooks.emit('beforeSchemaRead', context);
    const schema = await this.getSchema();
    await this.hooks.emit('afterSchemaRead', context, schema);

    const maybeModifiedQuestion =
      (await this.hooks.emit('beforePrompt', context, question)) ?? question;
    const queryText = typeof maybeModifiedQuestion === 'string' ? maybeModifiedQuestion : question;

    // Cache Key: "tenantId|question"
    const cacheKey = context.tenantId ? `${context.tenantId}|${queryText}` : queryText;

    let ragContext: import('../interfaces/vector-database.js').VectorSearchResult[] = [];
    let cachedSql: string | undefined;

    if (this.options.enableCaching) {
      // Tier 1: Exact Match Cache
      const exactMatchSql = await this.config.cache?.get<string>(cacheKey);
      if (exactMatchSql) {
        cachedSql = exactMatchSql;
        this.log('info', 'Exact cache hit, bypassing AI generation');
        this.emitTelemetry('sql_generated', 0, { cacheHit: true, sqlGenerated: cachedSql });
      }

      // Tier 2: RAG Vector Search & Semantic Caching
      if (!cachedSql && this.config.vectorDb) {
        await this.hooks.emit('beforeVectorSearch', context, question);
        
        const vectorResults = await this.config.vectorDb.search(
          queryText, 
          10, // Fetch top 10 to find both docs and potential cache hits
          context
        );

        for (const res of vectorResults) {
          if (res.metadata?.type === 'semantic_cache') {
            // If we found a cached SQL with > threshold similarity, reuse it
            const threshold = this.options.semanticCacheThreshold ?? 0.95;
            if (!cachedSql && res.score >= threshold && typeof res.metadata.sql === 'string') {
              cachedSql = res.metadata.sql;
              this.log('info', 'Semantic cache hit, bypassing AI generation', { score: res.score });
              this.emitTelemetry('sql_generated', 0, { cacheHit: true, sqlGenerated: cachedSql });
            }
          } else {
            ragContext.push(res);
          }
        }
        
        // Limit to top 3 RAG docs
        ragContext = ragContext.slice(0, 3);
        
        await this.hooks.emit('afterVectorSearch', context, ragContext);
      }
    } else if (this.config.vectorDb) {
      // Caching disabled, but we still need to do RAG search for context
      await this.hooks.emit('beforeVectorSearch', context, question);
      const vectorResults = await this.config.vectorDb.search(queryText, 3, context);
      ragContext = vectorResults.filter(r => r.metadata?.type !== 'semantic_cache');
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
    let rawGeneratedSql = '';
    let rows: Record<string, unknown>[] = [];

    for (let attempt = 0; attempt <= this.options.maxRetries; attempt++) {
      try {
        // Step 3: Generate SQL (or use Semantic Cache)
        if (cachedSql) {
          sql = cachedSql;
          rawGeneratedSql = cachedSql;
        } else {
          await this.hooks.emit('beforeGenerateSQL', context, promptPayload.systemPrompt);
          sql = await this.config.ai.generateSQL(
            promptPayload.systemPrompt + '\n\n' + promptPayload.userPrompt,
            promptPayload.relevantSchema,
          );
          const maybeModifiedSQL =
            (await this.hooks.emit('afterGenerateSQL', context, sql)) ?? sql;
          sql = typeof maybeModifiedSQL === 'string' ? maybeModifiedSQL : sql;
          rawGeneratedSql = sql;
        }

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
          // Tier 3: Query Result Cache — keyed by the final executed SQL
          const resultCacheTtl = this.options.queryResultCacheTtl ?? 300;
          const sqlCacheKey = context.tenantId ? `rows:${context.tenantId}|${sql}` : `rows:${sql}`;
          let resultFromCache = false;

          if (this.options.enableCaching && resultCacheTtl > 0) {
            const cachedRows = await this.config.cache?.get<Record<string, unknown>[]>(sqlCacheKey);
            if (cachedRows !== null && cachedRows !== undefined) {
              rows = cachedRows;
              resultFromCache = true;
              this.log('info', 'Tier 3 result cache hit, bypassing DB execution', { sql });
              this.emitTelemetry('sql_executed', 0, { resultCacheHit: true } as Partial<import('../interfaces/providers.js').TelemetryEvent>);
            }
          }

          if (!resultFromCache) {
            await this.hooks.emit('beforeExecute', context, sql);
            
            // Pass RLS configuration to the adapter via metadata
            if (this.options.rls) {
              context.metadata = { ...context.metadata, rls: this.options.rls };
            }
            if (this.options.rls?.enabled && this.config.db.dialect !== 'postgres') {
              this.log('warn', `Row-Level Security (RLS) is enabled, but native DB execution is only supported for PostgreSQL. The ${this.config.db.dialect} adapter will ignore this setting.`);
            }

            const result = await this.config.db.execute(sql, [], context);
            rows = this.scrubBlockedColumns(result.rows);
            await this.hooks.emit('afterExecute', context, sql, rows);

            // Write to Tier 3 result cache (only on fresh DB execution)
            if (this.options.enableCaching && resultCacheTtl > 0) {
              this.config.cache?.set(sqlCacheKey, rows, resultCacheTtl)
                .catch(err => this.log('warn', 'Failed to store result cache', { error: String(err) }));
            }
          }

          
          if (this.options.enableCaching && !cachedSql) {
            // Write to Tier 1: Exact Match Cache (store raw SQL so tenant scoping is applied fresh on retrieval)
            await this.config.cache?.set(cacheKey, rawGeneratedSql, 3600 * 24); // 24h TTL
            
            // Write to Tier 2: Semantic Cache
            if (this.config.vectorDb) {
              this.config.vectorDb.insert(
                queryText,
                { type: 'semantic_cache', sql: rawGeneratedSql },
                context
              ).catch(err => this.log('warn', 'Failed to store semantic cache', { error: String(err) }));
            }
          }
        }

        // Success — break out of retry loop
        break;
      } catch (error) {
        retryCount = attempt + 1;
        this.log('warn', `Attempt ${retryCount} failed`, { error: String(error) });
        this.emitTelemetry('retry', performance.now() - startTime, { retryCount });

        if (attempt >= this.options.maxRetries) {
          if (this.options.enableAuditLog) {
            this.log('error', 'Audit Log: Query Failed', {
              type: 'audit',
              question: queryText,
              tenantId: context.tenantId ?? 'global',
              error: String(error),
              executionMs: Math.round(performance.now() - startTime),
              retryCount,
            });
          }
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

    if (this.options.enableAuditLog) {
      this.log('info', 'Audit Log: Query Executed', {
        type: 'audit',
        question: queryText,
        tenantId: context.tenantId ?? 'global',
        sql,
        rowCount: rows.length,
        executionMs: Math.round(performance.now() - startTime),
        retryCount,
        tokenUsage: totalTokens,
      });
    }

    return { sql, rows, ragContext, retryCount, startTime, totalTokens };
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
      ? `\n\nIMPORTANT: The system will automatically scope queries to the current tenant. You do NOT need to manually add WHERE ${this.options.tenantScoping.column} = '...'. Generate standard SQL and it will be scoped automatically.`
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
*(Note: Use SELECT * and appropriate date functions for the ${schema.dialect} dialect.)*

**Example 3: Aggregation without hallucinating clauses**
User: "Total revenue"
SQL: SELECT SUM(total_amount) FROM orders
*(Note: Do not invent WHERE clauses like status='completed' unless explicitly asked by the user.)*

**Example 4: Always use SELECT * for single-table listing queries**
User: "Show the 5 most expensive products"
SQL: SELECT * FROM products ORDER BY price DESC LIMIT 5
*(Note: NEVER use SELECT name or SELECT id — always SELECT * unless using aggregation.)*

**Example 5: "My X" means current tenant's data — NEVER return CANNOT_ANSWER**
User: "My reviews"
SQL: SELECT * FROM reviews
*(Note: The word "my" means the current user's/business's data. The system will automatically scope it to the right tenant. Never return CANNOT_ANSWER for ownership queries.)*

**Example 6: "My X category" product filtering**
User: "My hardware products"
SQL: SELECT * FROM products WHERE category = 'hardware'
*(Note: Map category keywords like 'hardware', 'software', 'electronics' to the category column. Never return CANNOT_ANSWER.)*

**Example 7: Simple listing — always SELECT ***
User: "Oldest user"
SQL: SELECT * FROM users ORDER BY created_at ASC LIMIT 1
*(Note: Do not select just the name. Return SELECT * always for single-table queries.)*
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
- If the user asks multiple disjoint questions, you MUST answer all of them. Since SQL requires a single tabular structure, combine them into a single row using scalar subqueries. Do NOT use CTEs for disjoint structures.
- STRICT RULE: You MUST use SELECT * for almost all queries, unless you are using an aggregation function (like COUNT, SUM, AVG) or joining multiple tables where columns conflict. DO NOT select specific columns like 'name' or 'id' if you can use SELECT *.
- DO NOT use AS aliases for columns unless absolutely necessary (e.g. for aggregations).
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
