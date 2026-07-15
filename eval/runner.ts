import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { DatabaseAdapter, DatabaseAgent } from '@digitalchokro/core';
import { SQLiteAdapter } from '@digitalchokro/db-sqlite';
import { PostgresAdapter } from '@digitalchokro/db-postgres';
import { OpenAIProvider } from '@digitalchokro/provider-openai';
import { OllamaProvider } from '@digitalchokro/provider-ollama';
import { GeminiProvider } from '@digitalchokro/provider-gemini';
import deepEqual from 'fast-deep-equal';
import dotenv from 'dotenv';
import { generateHtmlReport, type EvalResult, type CategoryStats, type EvalReport } from './report-template.js';

dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));

interface EvalPair {
  category: string;
  question: string;
  expectedSql: string;
  tenantScoped: boolean;
}

async function runEval() {
  console.log('🚀 Starting Execution-Based Eval Harness');

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

  const providerName = process.env.EVAL_PROVIDER || 'gemini';
  const modelName = process.env.OLLAMA_MODEL || process.env.EVAL_MODEL || (providerName === 'openai' ? 'gpt-4o' : providerName === 'gemini' ? 'gemini-3.1-flash-lite' : 'qwen2.5-coder');
  
  let provider;
  if (providerName === 'ollama') {
    provider = new OllamaProvider({ model: modelName });
  } else if (providerName === 'gemini') {
    provider = new GeminiProvider({ apiKey: process.env.GEMINI_API_KEY || 'dummy', model: modelName });
  } else {
    provider = new OpenAIProvider({ apiKey: process.env.OPENAI_API_KEY || 'dummy' });
  }
  console.log(`Using AI Provider: ${provider.name} (${modelName})`);

  const results: EvalResult[] = [];
  let successCount = 0;
  const categoryStats: Record<string, CategoryStats> = {};

  for (const pair of seed) {
    if (!categoryStats[pair.category]) {
      categoryStats[pair.category] = { total: 0, success: 0, latencies: [] };
    }
    categoryStats[pair.category].total++;

    console.log(`\nEvaluating: "${pair.question}" [${pair.category}]`);

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
      const tenantContext = pair.tenantScoped ? { tenantId: 1 } : undefined;
      
      const res = await agent.ask(pair.question, tenantContext);
      
      const executionMs = performance.now() - start;

      let success = false;
      let errorMsg: string | undefined;

      if (res.sql && res.sql !== 'CANNOT_ANSWER') {
        try {
          const expectedSql = pair.postgresExpectedSql && adapter.dialect === 'postgres' ? pair.postgresExpectedSql : pair.expectedSql;
          const expectedResult = await adapter.execute(expectedSql);
          const generatedResult = await adapter.execute(res.sql);
          
          const expectedRowsStr = JSON.stringify(expectedResult.rows);
          const generatedRowsStr = JSON.stringify(generatedResult.rows);
          
          if (expectedRowsStr === generatedRowsStr) {
            success = true;
          } else {
            errorMsg = "Result rows do not match";
          }
        } catch (execErr) {
           errorMsg = `Execution Failed: ${execErr instanceof Error ? execErr.message : String(execErr)}`;
        }
      } else {
         errorMsg = res.sql === 'CANNOT_ANSWER' ? "Agent could not answer" : "No SQL generated";
      }
      
      if (success) {
        successCount++;
        categoryStats[pair.category].success++;
      }
      
      categoryStats[pair.category].latencies.push(executionMs);

      results.push({
        question: pair.question,
        category: pair.category,
        success,
        generatedSql: res.sql || '',
        expectedSql: pair.expectedSql,
        error: errorMsg,
        executionMs,
        tokenUsage: res.metadata?.tokens as any
      });
      
      if (success) {
        console.log(`✅ Success (${executionMs.toFixed(0)}ms)`);
      } else {
        console.log(`❌ Failed (${executionMs.toFixed(0)}ms): ${errorMsg}`);
        console.log(`   Generated: ${res.sql}`);
        console.log(`   Expected:  ${pair.expectedSql}`);
      }
    } catch (err) {
      const executionMs = performance.now() - start;
      categoryStats[pair.category].latencies.push(executionMs);
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

    // Do not dispose agent here because it closes the shared adapter
    // await agent.dispose();

    // Respect Gemini free tier rate limits (15 RPM = 4s, using 6.5s to be absolutely safe)
    if (providerName === 'gemini') {
      console.log('⏳ Rate limit backoff (6.5s)...');
      await new Promise(resolve => setTimeout(resolve, 6500));
    }
  }

  console.log('\n📊 Eval Results');
  const totalSuccessRate = ((successCount / seed.length) * 100).toFixed(1);
  console.log(`Total: ${seed.length}`);
  console.log(`Success: ${successCount} (${totalSuccessRate}%)`);
  
  for (const [cat, stats] of Object.entries(categoryStats)) {
    const rate = ((stats.success / stats.total) * 100).toFixed(1);
    console.log(` - ${cat}: ${stats.success}/${stats.total} (${rate}%)`);
  }
  
  let totalTokens = 0;
  for (const r of results) {
    if (r.tokenUsage) {
      totalTokens += (r.tokenUsage.input || 0) + (r.tokenUsage.output || 0);
    }
  }

  const finalReport: EvalReport = {
    providerName,
    modelName,
    runAt: new Date().toISOString(),
    total: seed.length,
    successCount,
    successRate: parseFloat(totalSuccessRate),
    totalTokens,
    categories: categoryStats,
    results
  };

  const reportJsonPath = path.join(__dirname, 'report.json');
  fs.writeFileSync(reportJsonPath, JSON.stringify(finalReport, null, 2));
  
  const reportHtmlPath = path.join(__dirname, 'report.html');
  fs.writeFileSync(reportHtmlPath, generateHtmlReport(finalReport));
  
  console.log(`Detailed JSON report saved to ${reportJsonPath}`);
  console.log(`Visual HTML report saved to ${reportHtmlPath}`);
  
  const passThreshold = parseFloat(process.env.EVAL_PASS_THRESHOLD || '70');
  if (parseFloat(totalSuccessRate) < passThreshold) {
    console.error(`❌ Eval Failed: Accuracy (${totalSuccessRate}%) is below the ${passThreshold}% threshold.`);
    process.exit(1);
  }
}

runEval().catch(console.error);
