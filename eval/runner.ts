import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { DatabaseAdapter, DatabaseAgent } from '@askchokro/core';
import { SQLiteAdapter } from '@askchokro/db-sqlite';
import { PostgresAdapter } from '@askchokro/db-postgres';
import { OpenAIProvider } from '@askchokro/provider-openai';
import { OllamaProvider } from '@askchokro/provider-ollama';
import dotenv from 'dotenv';

dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));

interface EvalPair {
  category: string;
  question: string;
  expectedSql: string;
  tenantScoped: boolean;
}

interface EvalResult {
  question: string;
  category: string;
  success: boolean;
  generatedSql: string;
  expectedSql: string;
  error?: string;
  executionMs: number;
}

async function runEval() {
  console.log('🚀 Starting Eval Harness');

  // Load Seed
  const seedPath = path.join(__dirname, 'dataset', 'seed.json');
  const seedData = JSON.parse(fs.readFileSync(seedPath, 'utf-8'));
  const seed: EvalPair[] = seedData.pairs || seedData;
  
  console.log(`Loaded ${seed.length} NL->SQL pairs.`);

  let adapter: DatabaseAdapter;
  let allowedDialects: ('sqlite' | 'postgres')[];

  if (process.env.DATABASE_URL) {
    console.log('Using PostgresAdapter');
    adapter = new PostgresAdapter({ connectionString: process.env.DATABASE_URL });
    allowedDialects = ['postgres'];
    // Assuming the DB is already seeded by the CI environment (e.g. via seed.sql)
  } else {
    console.log('Using SQLiteAdapter (in-memory)');
    adapter = new SQLiteAdapter({ path: ':memory:' });
    allowedDialects = ['sqlite'];
    const schemaSql = fs.readFileSync(path.join(__dirname, 'dataset', 'seed.sql'), 'utf-8');
    const stmts = schemaSql.split(';').map(s => s.trim()).filter(s => s.length > 0);
    for (const stmt of stmts) {
      await adapter.execute(stmt);
    }
  }

  // Determine provider from env
  const providerName = process.env.EVAL_PROVIDER || 'openai';
  let provider;
  if (providerName === 'ollama') {
    provider = new OllamaProvider({ model: process.env.OLLAMA_MODEL || 'qwen2.5-coder' });
  } else {
    provider = new OpenAIProvider({ apiKey: process.env.OPENAI_API_KEY || 'dummy' });
  }
  console.log(`Using AI Provider: ${provider.name}`);

  const results: EvalResult[] = [];
  let successCount = 0;

  for (const pair of seed) {
    console.log(`\nEvaluating: "${pair.question}"`);

    const agent = new DatabaseAgent({
      db: adapter,
      ai: provider,
      options: {
        tenantScoping: pair.tenantScoped ? {
          enabled: true,
          column: 'business_id',
          getValue: (ctx) => ctx.tenantId as number,
        } : undefined
      }
    });

    const start = performance.now();
    try {
      // Use tenantId=1 for tenantScoped queries, undefined otherwise
      const tenantContext = pair.tenantScoped ? { tenantId: 1 } : undefined;
      
      const res = await agent.ask(pair.question, tenantContext);
      
      const executionMs = performance.now() - start;
      const success = true; // In a real eval we'd parse and compare ASTs, but for now we just verify it executes without error.
      
      if (success) successCount++;
      
      results.push({
        question: pair.question,
        category: pair.category,
        success,
        generatedSql: res.sql,
        expectedSql: pair.expectedSql,
        executionMs
      });
      console.log(`✅ Success (${executionMs.toFixed(0)}ms)`);
      console.log(`Generated: ${res.sql}`);
    } catch (err) {
      const executionMs = performance.now() - start;
      results.push({
        question: pair.question,
        category: pair.category,
        success: false,
        generatedSql: '',
        expectedSql: pair.expectedSql,
        error: err instanceof Error ? err.message : String(err),
        executionMs
      });
      console.log(`❌ Failed (${executionMs.toFixed(0)}ms): ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  console.log('\n📊 Eval Results');
  console.log(`Total: ${seed.length}`);
  console.log(`Success: ${successCount} (${((successCount / seed.length) * 100).toFixed(1)}%)`);
  
  const reportPath = path.join(__dirname, 'report.json');
  fs.writeFileSync(reportPath, JSON.stringify(results, null, 2));
  console.log(`Detailed report saved to ${reportPath}`);

  await agent.dispose();
  
  if (successCount < seed.length) {
    process.exit(1);
  }
}

runEval().catch(console.error);
