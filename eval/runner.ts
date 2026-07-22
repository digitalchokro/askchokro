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
  postgresExpectedSql?: string;
  tenantScoped: boolean;
}

function compareRows(expected: any[], generated: any[]): boolean {
  if (expected.length !== generated.length) return false;
  if (expected.length === 0) return true;
  
  // Normalize: convert all values to strings for stable comparison
  const norm = (v: unknown) => (v === null || v === undefined ? 'NULL' : String(v));
  
  // Canonical row representation: sort by key, stringify values
  const canonRow = (r: any) =>
    Object.entries(r)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => `${k}=${norm(v)}`)
      .join('|');
  
  const canonSet = (rows: any[]) => rows.map(canonRow).sort().join('\n');

  // 1. Exact canonical match (handles column reordering, different key names that are same)
  if (canonSet(expected) === canonSet(generated)) return true;

  const expectedKeys = Object.keys(expected[0]);
  const generatedKeys = Object.keys(generated[0]);

  // 2. Superset match: generated has MORE columns than expected (e.g. model did SELECT *)
  //    Project generated down to expected's columns and compare.
  if (generatedKeys.length >= expectedKeys.length &&
      expectedKeys.every(k => generatedKeys.includes(k))) {
    const projected = generated.map(row => {
      const p: Record<string, unknown> = {};
      for (const k of expectedKeys) p[k] = row[k];
      return p;
    });
    if (canonSet(expected) === canonSet(projected)) return true;
  }

  // 3. Subset match: generated has FEWER columns than expected (e.g. model did SELECT name
  //    but expected ran SELECT * returning all columns)
  if (generatedKeys.length <= expectedKeys.length &&
      generatedKeys.every(k => expectedKeys.includes(k))) {
    const projected = expected.map(row => {
      const p: Record<string, unknown> = {};
      for (const k of generatedKeys) p[k] = row[k];
      return p;
    });
    if (canonSet(generated) === canonSet(projected)) return true;
  }

  // 4. Single-column value match: ignores column name entirely
  //    e.g. {product_name: 'A'} vs {name: 'A'}
  if (expectedKeys.length === 1 && generatedKeys.length === 1) {
    const expVals = expected.map(r => norm(Object.values(r)[0])).sort();
    const genVals = generated.map(r => norm(Object.values(r)[0])).sort();
    if (expVals.join(',') === genVals.join(',')) return true;
  }

  // 4b. Generated has 1 column, expected has many (e.g. SELECT * vs SELECT name AS alias)
  //     Check if generated values match ANY single column of expected
  if (generatedKeys.length === 1 && expectedKeys.length > 1) {
    const genVals = generated.map(r => norm(Object.values(r)[0])).sort().join(',');
    for (const k of expectedKeys) {
      const expColVals = expected.map(r => norm((r as any)[k])).sort().join(',');
      if (genVals === expColVals) return true;
    }
  }

  // 5. Multi-column value-only match: ignores all key names (handles alias differences)
  //    Only applies when both have the same column count
  if (expectedKeys.length === generatedKeys.length) {
    const expVals = expected.map(r => Object.values(r).map(norm).sort().join('|')).sort();
    const genVals = generated.map(r => Object.values(r).map(norm).sort().join('|')).sort();
    if (expVals.join('\n') === genVals.join('\n')) return true;
  }

  // 6. Semantic subset/superset with alias matching
  // If they have same row count, check if the VALUES of any column in expected
  // perfectly matches the VALUES of any column in generated.
  if (expected.length === generated.length && expected.length > 0) {
    // Forward: Does generated contain all expected columns? (Superset)
    let allExpectedColsFound = true;
    for (const expCol of expectedKeys) {
      const expColVals = expected.map(r => norm((r as any)[expCol])).sort().join(',');
      let foundMatch = false;
      for (const genCol of generatedKeys) {
         const genColVals = generated.map(r => norm((r as any)[genCol])).sort().join(',');
         if (expColVals === genColVals) {
           foundMatch = true;
           break;
         }
      }
      if (!foundMatch) {
        allExpectedColsFound = false;
        break;
      }
    }
    if (allExpectedColsFound && expectedKeys.length <= generatedKeys.length) return true;

    // Reverse: Does expected contain all generated columns? (Subset)
    let allGeneratedColsFound = true;
    for (const genCol of generatedKeys) {
      const genColVals = generated.map(r => norm((r as any)[genCol])).sort().join(',');
      let foundMatch = false;
      for (const expCol of expectedKeys) {
         const expColVals = expected.map(r => norm((r as any)[expCol])).sort().join(',');
         if (expColVals === genColVals) {
           foundMatch = true;
           break;
         }
      }
      if (!foundMatch) {
        allGeneratedColsFound = false;
        break;
      }
    }
    if (allGeneratedColsFound && generatedKeys.length <= expectedKeys.length) return true;
  }

  return false;
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
    let schemaSql = fs.readFileSync(path.join(__dirname, 'dataset', 'seed.sql'), 'utf-8');
    // Translate Postgres INTERVAL syntax back to SQLite for local eval testing
    schemaSql = schemaSql.replace(/CURRENT_TIMESTAMP - INTERVAL '(\d+) days'/g, "datetime('now', '-$1 days')");
    schemaSql = schemaSql.replace(/CURRENT_TIMESTAMP/g, "(datetime('now'))");

    const stmts = schemaSql.split(';').map(s => s.trim()).filter(s => s.length > 0);
    for (const stmt of stmts) {
      await adapter.execute(stmt);
    }
  }

  // ─── Provider cascade: Ollama → Groq → Gemini ────────────────────────────
  // EVAL_PROVIDER overrides the cascade; set to a single name to force one.
  // Cascade mode is the default when EVAL_PROVIDER is not set or is 'cascade'.
  const providerMode = process.env.EVAL_PROVIDER || 'cascade';

  const geminiKeys = [
    process.env.GEMINI_API_KEY,
    process.env.GEMINI_API_KEY_2,
    process.env.GEMINI_API_KEY_3,
    process.env.GEMINI_API_KEY_4,
  ].filter(Boolean).join(',');

  const groqKeys = [process.env.GROQ_API_KEY, process.env.GROQ_API_KEY_2].filter(Boolean).join(',');

  const ollamaModel  = process.env.OLLAMA_MODEL || 'qwen2.5-coder:3b';
  const groqModel    = process.env.GROQ_MODEL   || 'llama-3.3-70b-versatile';
  const geminiModel  = process.env.GEMINI_MODEL  || 'gemini-2.5-flash-lite';

  // Build a named list of providers in priority order for the cascade.
  type NamedProvider = { name: string; model: string; provider: ReturnType<typeof buildProvider> };

  function buildProvider(type: string, model: string): import('@digitalchokro/core').AIProvider {
    if (type === 'ollama') return new OllamaProvider({ model });
    if (type === 'groq') {
      return new OpenAIProvider({
        apiKey: groqKeys || 'dummy',
        model,
        baseURL: 'https://api.groq.com/openai/v1',
      });
    }
    if (type === 'gemini') {
      return new GeminiProvider({ apiKey: geminiKeys || 'dummy', model });
    }
    return new OpenAIProvider({ apiKey: process.env.OPENAI_API_KEY || 'dummy', model });
  }

  // Single-provider mode (forced via EVAL_PROVIDER env var)
  let providerCascade: NamedProvider[];
  if (providerMode === 'cascade') {
    providerCascade = [
      { name: 'ollama', model: ollamaModel,  provider: buildProvider('ollama', ollamaModel) },
      { name: 'groq',   model: groqModel,    provider: buildProvider('groq',   groqModel)   },
      { name: 'gemini', model: geminiModel,  provider: buildProvider('gemini', geminiModel)  },
    ];
    console.log('🔗 Provider cascade: ollama → groq → gemini');
  } else {
    const singleModel = process.env.EVAL_MODEL || (
      providerMode === 'openai' ? 'gpt-4o' :
      providerMode === 'groq'   ? groqModel :
      providerMode === 'gemini' ? geminiModel :
      ollamaModel
    );
    providerCascade = [{ name: providerMode, model: singleModel, provider: buildProvider(providerMode, singleModel) }];
    console.log(`Using AI Provider: ${providerMode} (${singleModel})`);
  }

  // Track which cascade index we're currently using
  let cascadeIndex = 0;
  const providerName = providerCascade[0]!.name;
  const modelName    = providerCascade[0]!.model;


  const results: EvalResult[] = [];
  let successCount = 0;
  const categoryStats: Record<string, CategoryStats> = {};

  for (const pair of seed) {
    if (!categoryStats[pair.category]) {
      categoryStats[pair.category] = { total: 0, success: 0, latencies: [] };
    }
    categoryStats[pair.category].total++;

    console.log(`\nEvaluating: "${pair.question}" [${pair.category}]`);

    // Try each provider in the cascade; advance on unrecoverable errors.
    let res: Awaited<ReturnType<typeof agent.ask>> | undefined;
    let lastError: unknown;

    while (cascadeIndex < providerCascade.length) {
      const { name: pName, model: pModel, provider } = providerCascade[cascadeIndex]!;

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

      try {
        const tenantContext = pair.tenantScoped ? { tenantId: 1 } : undefined;
        res = await agent.ask(pair.question, tenantContext);
        // Success — log which provider was used
        if (cascadeIndex > 0) {
          console.log(`  ↳ Used fallback provider: ${pName} (${pModel})`);
        }
        break;
      } catch (providerErr) {
        lastError = providerErr;
        const msg = providerErr instanceof Error ? providerErr.message : String(providerErr);
        console.warn(`  ⚠️  Provider [${pName}] failed: ${msg.slice(0, 120)}`);

        // Only advance cascade on quota/unavailability errors
        const isQuota = msg.includes('429') || msg.includes('quota') || msg.includes('rate') ||
                        msg.includes('RESOURCE_EXHAUSTED') || msg.includes('ECONNREFUSED');
        if (isQuota && cascadeIndex < providerCascade.length - 1) {
          cascadeIndex++;
          console.log(`  ↳ Falling back to: ${providerCascade[cascadeIndex]!.name}`);
          continue;
        }
        // Non-quota error or no more fallbacks — bail out of cascade
        break;
      }
    }

    const questionStart = performance.now();
    const executionMs = performance.now() - questionStart;

    if (!res) {
      categoryStats[pair.category].latencies.push(executionMs);
      results.push({
        question: pair.question,
        category: pair.category,
        success: false,
        generatedSql: '',
        expectedSql: pair.expectedSql,
        error: lastError instanceof Error ? lastError.message.slice(0, 200) : String(lastError ?? 'All providers failed'),
        executionMs
      });
      console.log(`❌ Failed: All providers exhausted`);
    } else {
      let success = false;
      let errorMsg: string | undefined;

      if (res.sql && res.sql !== 'CANNOT_ANSWER') {
        try {
          const expectedSql = pair.postgresExpectedSql && adapter.dialect === 'postgres' ? pair.postgresExpectedSql : pair.expectedSql;
          const expectedResult = await adapter.execute(expectedSql);
          const generatedResult = await adapter.execute(res.sql);
          
          if (compareRows(expectedResult.rows, generatedResult.rows)) {
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
    }

    // Polite rate-limit backoff — only for cloud providers
    const activeName = providerCascade[cascadeIndex]?.name ?? providerName;
    if (activeName === 'gemini') {
      console.log('⏳ Rate limit backoff (6.5s)...');
      await new Promise(resolve => setTimeout(resolve, 6500));
    } else if (activeName === 'groq') {
      // Groq free tier: ~30 req/min. 2s gap is safe.
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
    // Ollama is local — no backoff needed
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
    providerName: providerMode,
    modelName: providerCascade.map(p => p.model).join(' → '),
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
