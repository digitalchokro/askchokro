/**
 * @digitalchokro/provider-ollama — Ollama AI Provider
 *
 * Talks directly to the Ollama HTTP API (localhost:11434 by default).
 * Zero npm dependencies — uses native fetch().
 * Free, local, no API key required.
 */

import type { AIProvider, RelevantSchema } from '@digitalchokro/core';

export interface OllamaProviderConfig {
  /** The model name to use (e.g., 'qwen3'). See docs/RECOMMENDED_MODELS.md. */
  model: string;
  /** Ollama server URL. Default: 'http://localhost:11434'. */
  baseUrl?: string;
  /** Request timeout in milliseconds. Default: 60_000. */
  timeoutMs?: number;
}

export class OllamaProvider implements AIProvider {
  readonly name = 'ollama';

  private config: OllamaProviderConfig;
  private baseUrl: string;

  constructor(config: OllamaProviderConfig) {
    if (!config.model) {
      throw new Error(
        '[AskChokro] OllamaProvider requires a model name. ' +
        'See docs/RECOMMENDED_MODELS.md for suggestions.',
      );
    }
    this.config = config;
    this.baseUrl = config.baseUrl ?? 'http://localhost:11434';
  }

  async generateSQL(prompt: string, _schema: RelevantSchema): Promise<string> {
    const response = await fetch(`${this.baseUrl}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: this.config.model,
        prompt: prompt,
        stream: false,
        options: {
          temperature: 0, // SQL generation needs to be deterministic
        }
      }),
      signal: AbortSignal.timeout(this.config.timeoutMs ?? 60_000),
    });

    if (!response.ok) {
      throw new Error(`[AskChokro] Ollama API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json() as { response: string };
    
    // Extract SQL from markdown code block if present
    const content = data.response.trim();
    const sqlMatch = content.match(/```sql\s*([\s\S]*?)\s*```/i) || content.match(/```\s*([\s\S]*?)\s*```/);
    return sqlMatch && sqlMatch[1] ? sqlMatch[1].trim() : content;
  }

  async formatResponse(
    question: string,
    sql: string,
    rows: Record<string, unknown>[],
    ragContext?: import('@digitalchokro/core').VectorSearchResult[],
  ): Promise<{ answer: string; chart?: import('@digitalchokro/core').ChartConfig }> {
    let contextText = '';
    
    if (ragContext && ragContext.length > 0) {
      contextText += `\nUnstructured Documentation Context:\n${ragContext.map((r, i) => `[Doc ${i + 1}] ${r.text}`).join('\n\n')}\n`;
    }
    
    if (sql && sql !== "SELECT 'CANNOT_ANSWER' AS error") {
      contextText += `\nI ran this SQL query to find the answer:\n\`\`\`sql\n${sql}\n\`\`\`\nThe database returned these rows:\n${JSON.stringify(rows, null, 2)}\n`;
    }

    const prompt = `You are a helpful data assistant. 
The user asked: "${question}"
${contextText}
Provide a clear, concise, natural-language answer to the user's question based ONLY on the data above.

CRITICAL LANGUAGE RULE: You MUST reply in the exact same language and script the user used in their question (e.g., if the user asked in Bengali (বাংলা), reply in properly written Bengali. If they asked in Banglish (Bengali written with English letters), reply in Banglish. If English, reply in English). If the user explicitly asks you to reply in a specific language, follow that request exactly.

If the data represents a time-series, comparison, or categorical breakdown, generate a chart configuration as well.
The chart type must be one of: 'bar', 'line', 'pie'.
The xAxisKey should be the column name for the X-axis labels.
The yAxisKeys should be an array of column names for the Y-axis data.

You MUST respond in pure JSON format exactly like this:
{
  "answer": "Your text answer here.",
  "chart": { "type": "bar", "xAxisKey": "month", "yAxisKeys": ["revenue"] }
}`;

    const response = await fetch(`${this.baseUrl}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: this.config.model,
        prompt: prompt,
        stream: false,
        format: 'json',
        options: {
          temperature: 0.3,
        }
      }),
      signal: AbortSignal.timeout(this.config.timeoutMs ?? 60_000),
    });

    if (!response.ok) {
      throw new Error(`[AskChokro] Ollama API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json() as { response: string };
    const content = data.response.trim();
    try {
      const parsed = JSON.parse(content) as { answer?: string, chart?: import('@digitalchokro/core').ChartConfig };
      return {
        answer: parsed.answer || 'No answer generated.',
        chart: parsed.chart || undefined,
      };
    } catch {
      return { answer: content };
    }
  }

  async *streamResponse(
    question: string,
    sql: string,
    rows: Record<string, unknown>[],
    ragContext?: import('@digitalchokro/core').VectorSearchResult[],
  ): AsyncIterable<{ content?: string; chart?: import('@digitalchokro/core').ChartConfig; done?: boolean }> {
    let contextText = '';
    
    if (ragContext && ragContext.length > 0) {
      contextText += `\nUnstructured Documentation Context:\n${ragContext.map((r, i) => `[Doc ${i + 1}] ${r.text}`).join('\n\n')}\n`;
    }
    
    if (sql && sql !== "SELECT 'CANNOT_ANSWER' AS error") {
      contextText += `\nI ran this SQL query to find the answer:\n\`\`\`sql\n${sql}\n\`\`\`\nThe database returned these rows:\n${JSON.stringify(rows, null, 2)}\n`;
    }

    const prompt = `You are a helpful data assistant. 
The user asked: "${question}"
${contextText}
Provide a clear, concise, natural-language answer to the user's question based ONLY on the data above.

CRITICAL LANGUAGE RULE: You MUST reply in the exact same language and script the user used in their question.

If the data represents a time-series, comparison, or categorical breakdown, generate a chart configuration.
If you generate a chart, you MUST append it at the VERY END of your response inside a JSON block like this:
\`\`\`json
{ "type": "bar", "xAxisKey": "month", "yAxisKeys": ["revenue"] }
\`\`\`
The chart type must be one of: 'bar', 'line', 'pie'.`;

    const response = await fetch(`${this.baseUrl}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: this.config.model,
        prompt: prompt,
        stream: true,
        options: {
          temperature: 0.3,
        }
      }),
      signal: AbortSignal.timeout(this.config.timeoutMs ?? 60_000),
    });

    if (!response.ok) {
      throw new Error(`[AskChokro] Ollama API error: ${response.status} ${response.statusText}`);
    }

    if (!response.body) {
      throw new Error('[AskChokro] Ollama stream body is null');
    }

    let fullText = '';
    const reader = response.body.getReader();
    const decoder = new TextDecoder();

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunkStr = decoder.decode(value, { stream: true });
        // Ollama sends chunks of JSON string separated by newline
        const lines = chunkStr.split('\n').filter(Boolean);
        
        for (const line of lines) {
          try {
            const parsed = JSON.parse(line) as { response: string, done: boolean };
            const content = parsed.response || '';
            if (content) {
              fullText += content;
              if (!fullText.includes('```json')) {
                yield { content };
              }
            }
          } catch {
            // partial json line, ignore
          }
        }
      }
    } finally {
      reader.releaseLock();
    }

    const chartMatch = fullText.match(/```json\s*([\s\S]*?)\s*```/i);
    if (chartMatch && chartMatch[1]) {
      try {
        const chart = JSON.parse(chartMatch[1]) as import('@digitalchokro/core').ChartConfig;
        yield { chart };
      } catch {
        // Ignore
      }
    }
    
    yield { done: true };
  }

  async dispose(): Promise<void> {
    // No persistent connections to clean up
  }
}
