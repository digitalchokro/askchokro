/**
 * @digitalchokro/provider-openai — OpenAI AI Provider
 *
 * Uses the official OpenAI SDK to talk to GPT models.
 */

import type { AIProvider, RelevantSchema } from '@digitalchokro/core';
import OpenAI from 'openai';

export interface OpenAIProviderConfig {
  /** OpenAI API key(s) separated by commas for rotation. Falls back to OPENAI_API_KEY env var. */
  apiKey?: string;
  /** The model to use (e.g., 'gpt-4o'). See docs/RECOMMENDED_MODELS.md. */
  model?: string;
  /** Request timeout in milliseconds. Default: 30_000. */
  timeoutMs?: number;
  /** Custom base URL for OpenAI-compatible APIs (e.g. Groq) */
  baseURL?: string;
}

export class OpenAIProvider implements AIProvider {
  readonly name = 'openai';

  private config: OpenAIProviderConfig;
  private clients: OpenAI[];
  private currentClientIndex = 0;

  constructor(config: OpenAIProviderConfig = {}) {
    this.config = config;
    const keyString = config.apiKey || process.env.OPENAI_API_KEY || '';
    const keys = keyString.split(',').map(k => k.trim()).filter(Boolean);
    
    if (keys.length === 0) {
      this.clients = [new OpenAI({
        apiKey: process.env.OPENAI_API_KEY,
        timeout: config.timeoutMs ?? 30_000,
        baseURL: config.baseURL,
      })];
    } else {
      this.clients = keys.map(apiKey => new OpenAI({
        apiKey,
        timeout: config.timeoutMs ?? 30_000,
        baseURL: config.baseURL,
      }));
    }
  }

  private get client(): OpenAI {
    return this.clients[this.currentClientIndex]!;
  }

  private rotateKey(): boolean {
    if (this.currentClientIndex < this.clients.length - 1) {
      this.currentClientIndex++;
      console.warn(`[OpenAIProvider] Rate limit hit. Rotating to API key index ${this.currentClientIndex}.`);
      return true;
    }
    return false;
  }

  async generateSQL(prompt: string, _schema: RelevantSchema): Promise<string> {
    const model = this.config.model ?? 'gpt-4o';
    let lastErr: unknown;

    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const response = await this.client.chat.completions.create({
          model,
          messages: [{ role: 'user', content: prompt }],
          temperature: 0, // Deterministic for SQL
        });

        const content = response.choices[0]?.message?.content || '';
        
        // Extract SQL from markdown code block if present
        const sqlMatch = content.match(/```sql\s*([\s\S]*?)\s*```/i) || content.match(/```\s*([\s\S]*?)\s*```/);
        return sqlMatch && sqlMatch[1] ? sqlMatch[1].trim() : content.trim();
      } catch (err: unknown) {
        lastErr = err;
        const errStatus = (err as { status?: number })?.status;
        const errMsg = err instanceof Error ? err.message : '';
        if (errStatus === 429 || errMsg.includes('429')) {
          if (this.rotateKey()) continue;
          
          const delayMs = 15000;
          console.warn(`[OpenAIProvider] Rate limited (429). Retrying in ${delayMs}ms...`);
          await new Promise(r => setTimeout(r, delayMs));
          continue;
        }
        throw err;
      }
    }
    throw lastErr;
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
  "chart": { "type": "bar", "xAxisKey": "month", "yAxisKeys": ["revenue"] } // OR null if no chart makes sense
}`;

    const model = this.config.model ?? 'gpt-4o';
    let lastErr: unknown;
    let content = '{}';

    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const response = await this.client.chat.completions.create({
          model,
          messages: [{ role: 'user', content: prompt }],
          temperature: 0.3,
          response_format: { type: 'json_object' },
        });

        content = response.choices[0]?.message?.content || '{}';
        break;
      } catch (err: unknown) {
        lastErr = err;
        const errStatus = (err as { status?: number })?.status;
        const errMsg = err instanceof Error ? err.message : '';
        if (errStatus === 429 || errMsg.includes('429')) {
          if (this.rotateKey()) continue;
          
          const delayMs = 15000;
          console.warn(`[OpenAIProvider] Rate limited (429). Retrying in ${delayMs}ms...`);
          await new Promise(r => setTimeout(r, delayMs));
          continue;
        }
        throw err;
      }
    }

    if (lastErr && content === '{}') {
      throw lastErr instanceof Error ? lastErr : new Error(typeof lastErr === 'string' ? lastErr : 'Unknown error');
    }

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

    const model = this.config.model ?? 'gpt-4o';
    let lastErr: unknown;
    let stream: AsyncIterable<{ choices: Array<{ delta?: { content?: string | null } }> }> | undefined;

    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        stream = await this.client.chat.completions.create({
          model,
          messages: [{ role: 'user', content: prompt }],
          temperature: 0.3,
          stream: true,
        });
        lastErr = undefined;
        break;
      } catch (err: unknown) {
        lastErr = err;
        const errStatus = (err as { status?: number })?.status;
        const errMsg = err instanceof Error ? err.message : '';
        if (errStatus === 429 || errMsg.includes('429')) {
          if (this.rotateKey()) continue;
          
          const delayMs = 15000;
          console.warn(`[OpenAIProvider] Rate limited (429). Retrying in ${delayMs}ms...`);
          await new Promise(r => setTimeout(r, delayMs));
          continue;
        }
        throw err;
      }
    }

    if (lastErr || !stream) {
      throw lastErr instanceof Error ? lastErr : new Error((typeof lastErr === 'string' ? lastErr : null) || 'Failed to create stream');
    }

    let fullText = '';
    
    for await (const chunk of stream) {
      const content = chunk.choices[0]?.delta?.content || '';
      if (content) {
        fullText += content;
        // Only yield content if we haven't started seeing the json block
        if (!fullText.includes('```json')) {
          yield { content };
        }
      }
    }
    
    // Parse chart at the end if present
    const chartMatch = fullText.match(/```json\s*([\s\S]*?)\s*```/i);
    if (chartMatch && chartMatch[1]) {
      try {
        const chart = JSON.parse(chartMatch[1]) as import('@digitalchokro/core').ChartConfig;
        yield { chart };
      } catch {
        // Ignore chart parse errors during stream
      }
    }
    
    yield { done: true };
  }

  async dispose(): Promise<void> {
    // No persistent connections
  }
}
