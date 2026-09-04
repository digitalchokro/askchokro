import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { DatabaseAdapter, DatabaseAgent, isCannotAnswer } from '@digitalchokro/core';
import { SQLiteAdapter } from '@digitalchokro/db-sqlite';
import { PostgresAdapter } from '@digitalchokro/db-postgres';
import { OpenAIProvider } from '@digitalchokro/provider-openai';
import { AnthropicProvider } from '@digitalchokro/provider-anthropic';
import { OllamaProvider } from '@digitalchokro/provider-ollama';
import { GeminiProvider } from '@digitalchokro/provider-gemini';
import { GroqProvider } from '@digitalchokro/provider-groq';
import dotenv from 'dotenv';
import { generateHtmlReport, type EvalResult, type CategoryStats, type EvalReport } from './report-template.js';

dotenv.config();

/**
 * Strategies 4b/5/6 in compareRows() ignore column names entirely, so a query
 * that returns the right values from the wrong column scores as a pass. They
 * are useful when exploring a new dataset but inflate the headline accuracy,
 * so they stay off unless EVAL_LOOSE_MATCH is set.
 */
const LOOSE_MATCH = process.env.EVAL_LOOSE_MATCH === '1' || process.env.EVAL_LOOSE_MATCH === 'true';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

interface EvalPair {
  category: string;
  question: string;
  expectedSql: string;
  postgresExpectedSql?: string;
  tenantScoped: boolean;
}

/**
 * Takes `max` pairs while keeping every category represented. The dataset is
 * grouped by category, so a plain slice(0, max) only ever exercises the first
 * one or two of them — which made truncated CI runs report an accuracy figure
 * for a completely different question mix than a full run.
 */
function stratifiedSample(pairs: EvalPair[], max: number): EvalPair[] {
  const byCategory = new Map<string, EvalPair[]>();
  for (const pair of pairs) {
    const bucket = byCategory.get(pair.category);
    if (bucket) bucket.push(pair);
    else byCategory.set(pair.category, [pair]);
  }

  const buckets = [...byCategory.values()];
  const picked = new Set<EvalPair>();

  for (let round = 0; picked.size < max; round++) {
    let tookAny = false;
    for (const bucket of buckets) {
      const pair = bucket[round];
      if (!pair) continue;
      picked.add(pair);
      tookAny = true;
      if (picked.size === max) break;
    }
    if (!tookAny) break;
  }

  // Keep the dataset's original ordering so reports stay comparable run to run.
  return pairs.filter(p => picked.has(p));
}

type Row = Record<string, unknown>;

/** unknown → readable message, without risking a bare "[object Object]". */
function errorMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  if (typeof err === 'string') return err;
  return JSON.stringify(err) ?? 'Unknown error';
}

function compareRows(expected: Row[], generated: Row[]): boolean {
  if (expected.length !== generated.length) return false;
  if (expected.length === 0) return true;

  // Normalize every cell to a string so that a Postgres numeric and a SQLite
  // integer holding the same value still compare equal.
  const norm = (v: unknown): string => {
    if (v === null || v === undefined) return 'NULL';
    if (typeof v === 'string') return v;
    if (typeof v === 'number' || typeof v === 'bigint' || typeof v === 'boolean') return String(v);
    if (v instanceof Date) return v.toISOString();
    return JSON.stringify(v) ?? 'NULL';
  };

  // Canonical row representation: sort by key, stringify values
  const canonRow = (r: Row): string =>
    Object.entries(r)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => `${k}=${norm(v)}`)
      .join('|');

  const canonSet = (rows: Row[]): string => rows.map(canonRow).sort().join('\n');

  // 1. Exact canonical match (handles column reordering, different key names that are same)
  if (canonSet(expected) === canonSet(generated)) return true;

  const firstExpected = expected[0];
  const firstGenerated = generated[0];
  if (!firstExpected || !firstGenerated) return false;

  const expectedKeys = Object.keys(firstExpected);
  const generatedKeys = Object.keys(firstGenerated);

  // 2. Superset match: generated has MORE columns than expected (e.g. model did SELECT *)
  //    Project generated down to expected's columns and compare.
  if (generatedKeys.length >= expectedKeys.length &&
      expectedKeys.every(k => generatedKeys.includes(k))) {
    const projected = generated.map(row => {
      const p: Row = {};
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
      const p: Row = {};
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
  if (LOOSE_MATCH && generatedKeys.length === 1 && expectedKeys.length > 1) {
    const genVals = generated.map(r => norm(Object.values(r)[0])).sort().join(',');
    for (const k of expectedKeys) {
      const expColVals = expected.map(r => norm(r[k])).sort().join(',');
      if (genVals === expColVals) return true;
    }
  }

  // 5. Multi-column value-only match: ignores all key names (handles alias differences)
  //    Only applies when both have the same column count
  if (LOOSE_MATCH && expectedKeys.length === generatedKeys.length) {
    const expVals = expected.map(r => Object.values(r).map(norm).sort().join('|')).sort();
    const genVals = generated.map(r => Object.values(r).map(norm).sort().join('|')).sort();
    if (expVals.join('\n') === genVals.join('\n')) return true;
  }

  // 6. Semantic subset/superset with alias matching
  // If they have same row count, check if the VALUES of any column in expected
  // perfectly matches the VALUES of any column in generated.
  if (LOOSE_MATCH && expected.length === generated.length && expected.length > 0) {
    // Forward: Does generated contain all expected columns? (Superset)
    let allExpectedColsFound = true;
    for (const expCol of expectedKeys) {
      const expColVals = expected.map(r => norm(r[expCol])).sort().join(',');
      let foundMatch = false;
      for (const genCol of generatedKeys) {
         const genColVals = generated.map(r => norm(r[genCol])).sort().join(',');
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
      const genColVals = generated.map(r => norm(r[genCol])).sort().join(',');
      let foundMatch = false;
      for (const expCol of expectedKeys) {
         const expColVals = expected.map(r => norm(r[expCol])).sort().join(',');
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

async function runEval(): Promise<void> {
  console.log('🚀 Starting Execution-Based Eval Harness');

  const seedPath = path.join(__dirname, 'dataset', 'seed.json');
  const seedData: unknown = JSON.parse(fs.readFileSync(seedPath, 'utf-8'));
  const rawPairs = Array.isArray(seedData)
    ? seedData
    : (seedData as { pairs?: unknown }).pairs;
  if (!Array.isArray(rawPairs)) {
    throw new Error(`${seedPath} must be an array of pairs, or an object with a "pairs" array.`);
  }
  let seed = rawPairs as EvalPair[];

  if (process.env.EVAL_MAX_QUESTIONS) {
    const max = parseInt(process.env.EVAL_MAX_QUESTIONS, 10);
    if (Number.isFinite(max) && max > 0 && max < seed.length) {
      seed = stratifiedSample(seed, max);
      console.log(`Limited dataset to ${seed.length} pairs via EVAL_MAX_QUESTIONS (stratified across categories).`);
    }
  }

  console.log(`Loaded ${seed.length} NL->SQL pairs.`);

  let adapter: DatabaseAdapter;

  if (process.env.DATABASE_URL) {
    console.log('Using PostgresAdapter');
    adapter = new PostgresAdapter({ connectionString: process.env.DATABASE_URL });
  } else {
    console.log('Using SQLiteAdapter (in-memory)');
    adapter = new SQLiteAdapter({ path: ':memory:' });
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
  const openaiModel  = process.env.OPENAI_MODEL  || 'gpt-4o';
  const anthropicModel = process.env.ANTHROPIC_MODEL || 'claude-3-5-sonnet-20240620';

  // Build a named list of providers in priority order for the cascade.
  type NamedProvider = { name: string; model: string; provider: ReturnType<typeof buildProvider> };

  function buildProvider(type: string, model: string): import('@digitalchokro/core').AIProvider {
    if (type === 'ollama') return new OllamaProvider({ model });
    if (type === 'groq') {
      return new GroqProvider({
        apiKey: groqKeys || 'dummy',
        model,
      });
    }
    if (type === 'gemini') {
      return new GeminiProvider({ apiKey: geminiKeys || 'dummy', model });
    }
    if (type === 'anthropic') {
      return new AnthropicProvider({ apiKey: process.env.ANTHROPIC_API_KEY || 'dummy', model });
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
      providerMode === 'openai'    ? openaiModel :
      providerMode === 'anthropic' ? anthropicModel :
      providerMode === 'groq'      ? groqModel :
      providerMode === 'gemini'    ? geminiModel :
      ollamaModel
    );
    providerCascade = [{ name: providerMode, model: singleModel, provider: buildProvider(providerMode, singleModel) }];
    console.log(`Using AI Provider: ${providerMode} (${singleModel})`);
  }

  // Every question restarts the cascade from `cascadeFloor` so that one
  // transient 429 does not silently demote the whole run to a weaker model and
  // report the result under the primary provider's name. The floor only moves
  // when a provider is structurally unavailable (no local Ollama, say), which
  // would otherwise cost every remaining question a guaranteed failed attempt.
  let cascadeFloor = 0;
  const providerName = providerCascade[0]!.name;


  const results: EvalResult[] = [];
  let successCount = 0;
  const categoryStats: Record<string, CategoryStats> = {};

  for (const pair of seed) {
    const stats = (categoryStats[pair.category] ??= { total: 0, success: 0, latencies: [] });
    stats.total++;

    console.log(`\nEvaluating: "${pair.question}" [${pair.category}]`);

    // Try each provider in the cascade; advance on unrecoverable errors.
    let res: Awaited<ReturnType<DatabaseAgent['ask']>> | undefined;
    let lastError: unknown;
    let cascadeIndex = cascadeFloor;
    const questionStart = performance.now();

    // Start the clock BEFORE the first provider attempt — otherwise latency is
    // measured over an empty window and every row reports ~0ms.
    const questionStart = performance.now();

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
        const msg = errorMessage(providerErr);
        console.warn(`  ⚠️  Provider [${pName}] failed: ${msg.slice(0, 120)}`);

        // Only advance cascade on quota/unavailability errors
        const isQuota = msg.includes('429') || msg.includes('quota') || msg.includes('rate') ||
                        msg.includes('RESOURCE_EXHAUSTED') || msg.includes('ECONNREFUSED');
        if (isQuota && cascadeIndex < providerCascade.length - 1) {
          // A refused connection means the provider is not running at all, so
          // skip it for the rest of the run rather than retrying it per question.
          if (msg.includes('ECONNREFUSED')) {
            cascadeFloor = cascadeIndex + 1;
          }
          cascadeIndex++;
          console.log(`  ↳ Falling back to: ${providerCascade[cascadeIndex]!.name}`);
          continue;
        }
        // Non-quota error or no more fallbacks — bail out of cascade
        break;
      }
    }

    const executionMs = performance.now() - questionStart;

    if (!res) {
      stats.latencies.push(executionMs);
      results.push({
        question: pair.question,
        category: pair.category,
        success: false,
        generatedSql: '',
        expectedSql: pair.expectedSql,
        error: (lastError === undefined ? 'All providers failed' : errorMessage(lastError)).slice(0, 200),
        executionMs
      });
      console.log(`❌ Failed: All providers exhausted`);
    } else {
      let success = false;
      let errorMsg: string | undefined;

      if (res.sql && !isCannotAnswer(res.sql)) {
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
           errorMsg = `Execution Failed: ${errorMessage(execErr)}`;
        }
      } else {
         errorMsg = res.sql && isCannotAnswer(res.sql) ? "Agent could not answer" : "No SQL generated";
      }
      
      if (success) {
        successCount++;
        stats.success++;
      }
      
      stats.latencies.push(executionMs);

      results.push({
        question: pair.question,
        category: pair.category,
        success,
        generatedSql: res.sql || '',
        expectedSql: pair.expectedSql,
        error: errorMsg,
        executionMs,
        tokenUsage: res.tokenUsage
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

  const passThreshold = parseFloat(process.env.EVAL_PASS_THRESHOLD || '70');

  const finalReport: EvalReport = {
    providerName: providerMode,
    modelName: providerCascade.map(p => p.model).join(' → '),
    runAt: new Date().toISOString(),
    total: seed.length,
    successCount,
    successRate: parseFloat(totalSuccessRate),
    totalTokens,
    passThreshold,
    categories: categoryStats,
    results
  };

  const reportJsonPath = path.join(__dirname, 'report.json');
  fs.writeFileSync(reportJsonPath, JSON.stringify(finalReport, null, 2));
  
  const reportHtmlPath = path.join(__dirname, 'report.html');
  fs.writeFileSync(reportHtmlPath, generateHtmlReport(finalReport));
  
  console.log(`Detailed JSON report saved to ${reportJsonPath}`);
  console.log(`Visual HTML report saved to ${reportHtmlPath}`);

  if (parseFloat(totalSuccessRate) < passThreshold) {
    console.error(`❌ Eval Failed: Accuracy (${totalSuccessRate}%) is below the ${passThreshold}% threshold.`);
    process.exit(1);
  }
}

runEval().catch(console.error);
