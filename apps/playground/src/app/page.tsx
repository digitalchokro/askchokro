'use client';

import { useState } from 'react';
import { Database, Send, Terminal, Loader2, KeyRound, Radio } from 'lucide-react';

interface AskResultResponse {
  answer: string | null;
  sql: string;
  rows: Record<string, unknown>[];
  executionMs: number;
  tokenUsage?: { input: number; output: number };
  retryCount?: number;
}

export default function Playground() {
  const [question, setQuestion] = useState('');
  const [dbUrl, setDbUrl] = useState('');
  const [streamEnabled, setStreamEnabled] = useState(true);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<AskResultResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showConfig, setShowConfig] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!question.trim()) return;

    setLoading(true);
    setError(null);
    setResult(null);

    const startTime = performance.now();

    try {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (dbUrl) headers['x-database-url'] = dbUrl;

      if (streamEnabled) {
        const res = await fetch('/api/ask/stream', {
          method: 'POST',
          headers,
          body: JSON.stringify({ question }),
        });

        if (!res.ok) {
          throw new Error(`Failed to initiate stream: ${res.statusText}`);
        }

        const reader = res.body?.getReader();
        if (!reader) throw new Error('ReadableStream not supported.');

        const decoder = new TextDecoder();
        let buffer = '';
        const accumulatedRows: Record<string, unknown>[] = [];
        let accumulatedSql = '';

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const parts = buffer.split('\n\n');
          buffer = parts.pop() || '';

          for (const part of parts) {
            const trimmed = part.trim();
            if (trimmed.startsWith('data: ')) {
              try {
                const chunk = JSON.parse(trimmed.slice(6));
                if (chunk.type === 'sql' && chunk.sql) {
                  accumulatedSql = chunk.sql;
                  setResult({
                    answer: null,
                    sql: chunk.sql,
                    rows: [],
                    executionMs: performance.now() - startTime,
                  });
                } else if (chunk.type === 'row' && chunk.row) {
                  accumulatedRows.push(chunk.row as Record<string, unknown>);
                  setResult({
                    answer: null,
                    sql: accumulatedSql,
                    rows: [...accumulatedRows],
                    executionMs: performance.now() - startTime,
                  });
                } else if (chunk.type === 'done') {
                  const execMs = (chunk.metadata?.executionMs as number) || (performance.now() - startTime);
                  setResult((prev) => prev ? { ...prev, executionMs: execMs } : null);
                } else if (chunk.error) {
                  throw new Error(chunk.error as string);
                }
              } catch (parseErr: unknown) {
                if (parseErr instanceof Error && parseErr.message !== 'Unexpected end of JSON input') {
                  console.debug('SSE chunk parse error:', parseErr);
                }
              }
            }
          }
        }
      } else {
        const res = await fetch('/api/ask', {
          method: 'POST',
          headers,
          body: JSON.stringify({ question }),
        });

        const data = await res.json() as AskResultResponse & { error?: { message?: string } };
        if (!res.ok) {
          throw new Error(data.error?.message || 'Failed to execute query');
        }

        setResult(data);
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-200 font-sans selection:bg-indigo-500/30">
      {/* Header */}
      <header className="border-b border-neutral-800 bg-neutral-900/50 backdrop-blur-sm sticky top-0 z-10 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#27C6ED] to-[#373DE0] flex items-center justify-center shadow-sm shadow-[#27C6ED]/20">
            <Terminal className="w-4 h-4 text-white" />
          </div>
          <div>
            <h1 className="text-lg font-semibold text-white leading-none tracking-tight">AskChokro</h1>
            <p className="text-xs text-neutral-400 mt-1">Playground</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* Stream Toggle */}
          <button
            type="button"
            onClick={() => setStreamEnabled(!streamEnabled)}
            className={`flex items-center gap-2 px-3 py-1.5 text-xs font-medium rounded-md border transition-colors ${
              streamEnabled 
                ? 'bg-[#27C6ED]/10 border-[#27C6ED]/30 text-[#27C6ED]' 
                : 'border-neutral-700 text-neutral-400 hover:bg-neutral-800'
            }`}
          >
            <Radio className={`w-3.5 h-3.5 ${streamEnabled ? 'animate-pulse text-[#27C6ED]' : ''}`} />
            {streamEnabled ? 'SSE Stream Active' : 'Batch Mode'}
          </button>

          <button 
            onClick={() => setShowConfig(!showConfig)}
            className="flex items-center gap-2 px-3 py-1.5 text-xs rounded-md border border-neutral-700 hover:bg-neutral-800 transition-colors"
          >
            <Database className="w-3.5 h-3.5 text-indigo-400" />
            {dbUrl ? 'Custom DB' : 'Demo DB'}
          </button>
        </div>
      </header>

      {/* Main layout */}
      <main className="max-w-6xl mx-auto p-6 flex flex-col lg:flex-row gap-6 h-[calc(100vh-73px)]">
        
        {/* Left column: Chat / Input */}
        <div className="flex-1 flex flex-col gap-4 max-w-lg w-full">
          {showConfig && (
            <div className="p-4 rounded-xl border border-indigo-900/50 bg-indigo-950/20 shadow-lg">
              <h2 className="text-sm font-semibold text-indigo-300 mb-3 flex items-center gap-2">
                <KeyRound className="w-4 h-4" /> Connection Config
              </h2>
              <p className="text-xs text-neutral-400 mb-3">
                Provide a PostgreSQL, DuckDB, or ClickHouse connection string. Leave blank to use the in-memory SQLite demo database.
              </p>
              <input
                type="text"
                value={dbUrl}
                onChange={(e) => setDbUrl(e.target.value)}
                placeholder="postgres://user:pass@host:5432/db"
                className="w-full bg-neutral-900 border border-neutral-800 rounded-md px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
              />
            </div>
          )}

          <div className="flex-1 flex flex-col justify-end bg-neutral-900/30 rounded-2xl border border-neutral-800/50 p-4 shadow-sm relative overflow-hidden">
            {/* Background decoration */}
            <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-b from-transparent to-neutral-900/50 pointer-events-none" />
            
            <div className="relative z-10 w-full">
              <form onSubmit={handleSubmit} className="relative">
                <input
                  type="text"
                  value={question}
                  onChange={(e) => setQuestion(e.target.value)}
                  placeholder="e.g. Which products cost more than $50?"
                  className="w-full bg-neutral-900 border border-neutral-700 text-white rounded-xl pl-4 pr-12 py-4 text-base focus:outline-none focus:ring-2 focus:ring-[#27C6ED]/50 focus:border-[#27C6ED] transition-all shadow-inner"
                  disabled={loading}
                />
                <button
                  type="submit"
                  disabled={loading || !question.trim()}
                  className="absolute right-2 top-2 bottom-2 aspect-square flex items-center justify-center bg-[#27C6ED] hover:bg-[#12a8cf] disabled:bg-neutral-800 disabled:text-neutral-600 text-neutral-950 font-bold rounded-lg transition-all"
                >
                  {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5 ml-[-2px]" />}
                </button>
              </form>
            </div>
          </div>
        </div>

        {/* Right column: Results */}
        <div className="flex-[2] flex flex-col gap-6 overflow-hidden">
          {error && (
            <div className="p-4 bg-red-950/30 border border-red-900/50 rounded-xl text-red-200 text-sm">
              <span className="font-semibold block mb-1">Error executing query:</span>
              {error}
            </div>
          )}

          {!result && !error && !loading && (
            <div className="flex-1 border border-neutral-800/50 border-dashed rounded-2xl flex flex-col items-center justify-center text-neutral-500 gap-4">
              <Terminal className="w-12 h-12 text-neutral-700" />
              <p>Ask a question to see real-time streaming SQL and tabular results.</p>
            </div>
          )}

          {loading && !result && (
            <div className="flex-1 border border-neutral-800/50 rounded-2xl flex flex-col items-center justify-center text-[#27C6ED] gap-4 bg-neutral-900/20">
              <Loader2 className="w-8 h-8 animate-spin" />
              <p className="animate-pulse">Generating SQL...</p>
            </div>
          )}

          {result && (
            <div className="flex-1 flex flex-col gap-4 overflow-hidden">
              <div className="bg-neutral-900 rounded-xl border border-neutral-800 overflow-hidden shadow-sm shrink-0">
                <div className="bg-neutral-950 px-4 py-2 text-xs font-mono text-neutral-400 border-b border-neutral-800 flex justify-between">
                  <span>Generated SQL</span>
                  <span className="text-[#27C6ED]">{(result.executionMs || 0).toFixed(1)}ms</span>
                </div>
                <div className="p-4 overflow-x-auto">
                  <pre className="text-sm font-mono text-emerald-400 whitespace-pre-wrap">{result.sql}</pre>
                </div>
              </div>

              <div className="flex-1 bg-neutral-900 rounded-xl border border-neutral-800 overflow-hidden shadow-sm flex flex-col">
                <div className="bg-neutral-950 px-4 py-2 text-xs font-mono text-neutral-400 border-b border-neutral-800 flex justify-between items-center">
                  <span>Result Rows ({result.rows?.length || 0})</span>
                  {loading && (
                    <span className="text-[#27C6ED] text-[11px] animate-pulse flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-[#27C6ED] animate-ping" />
                      Streaming rows...
                    </span>
                  )}
                </div>
                <div className="flex-1 overflow-auto p-0">
                  {result.rows && result.rows.length > 0 ? (
                    <table className="w-full text-sm text-left whitespace-nowrap">
                      <thead className="text-xs text-neutral-400 bg-neutral-900/50 sticky top-0">
                        <tr>
                          {Object.keys(result.rows[0]).map((key) => (
                            <th key={key} className="px-4 py-3 font-medium border-b border-neutral-800">{key}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-neutral-800/50">
                        {result.rows.map((row: Record<string, unknown>, i: number) => (
                          <tr key={i} className="hover:bg-neutral-800/30 transition-colors">
                            {Object.values(row).map((val: unknown, j: number) => (
                              <td key={j} className="px-4 py-3 text-neutral-300">
                                {val === null ? <span className="text-neutral-600 italic">null</span> : String(val)}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  ) : (
                    <div className="p-8 text-center text-neutral-500">
                      {loading ? 'Streaming results...' : 'No rows returned.'}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

      </main>
    </div>
  );
}
