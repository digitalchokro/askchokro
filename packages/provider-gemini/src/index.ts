/**
 * @digitalchokro/provider-gemini — Google Gemini AI Provider
 *
 * Uses the official @google/genai SDK to talk to Gemini models.
 */

import type { AIProvider, RelevantSchema } from '@digitalchokro/core';
import { GoogleGenAI } from '@google/genai';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isUnknownArray(value: unknown): value is unknown[] {
  return Array.isArray(value);
}

function isChartConfig(value: unknown): value is import('@digitalchokro/core').ChartConfig {
  if (!isRecord(value)) {
    return false;
  }

  return (
    (value.type === 'bar' || value.type === 'line' || value.type === 'pie') &&
    typeof value.xAxisKey === 'string' &&
    isUnknownArray(value.yAxisKeys) &&
    value.yAxisKeys.every((item) => typeof item === 'string')
  );
}

export interface GeminiProviderConfig {
  /** Gemini API key. Falls back to GEMINI_API_KEY env var. */
  apiKey?: string;
  /** The model to use. Defaults to 'gemini-2.5-flash'. */
  model?: string;
}

export class GeminiProvider implements AIProvider {
  readonly name = 'gemini';

  private config: GeminiProviderConfig;
  private ai: GoogleGenAI;

  constructor(config: GeminiProviderConfig = {}) {
    this.config = config;
    this.ai = new GoogleGenAI({
      apiKey: config.apiKey, // defaults to process.env.GEMINI_API_KEY automatically by SDK
    });
  }

  async generateSQL(prompt: string, _schema: RelevantSchema): Promise<string> {
    const model = this.config.model ?? 'gemini-2.5-flash';

    let response;
    let lastErr;
    for (let attempt = 0; attempt < 5; attempt++) {
      try {
        response = await this.ai.models.generateContent({
          model,
          contents: prompt,
          config: {
            temperature: 0, // Deterministic for SQL
          },
        });
        break;
      } catch (err: any) {
        lastErr = err;
        if (err?.status === 429 || err?.message?.includes('429') || err?.message?.includes('Quota exceeded')) {
          const match = err.message.match(/retry in ([\d\.]+)s/i);
          const delayMs = match ? Math.ceil(parseFloat(match[1]) * 1000) + 1000 : 15000;
          console.warn(`[GeminiProvider] Rate limited (429). Retrying in ${delayMs}ms...`);
          await new Promise(r => setTimeout(r, delayMs));
          continue;
        }
        throw err;
      }
    }
    if (!response) throw lastErr;

    const responseText: unknown = response.text;
    const content = typeof responseText === 'string' ? responseText : '';

    let cleaned = content.trim();
    const sqlMatch = cleaned.match(/```sql\s*([\s\S]*?)\s*```/i) || cleaned.match(/```\s*([\s\S]*?)\s*```/);
    if (sqlMatch && sqlMatch[1]) {
      cleaned = sqlMatch[1].trim();
    }

    // Aggressively strip [SQL] tags
    cleaned = cleaned.replace(/^\[SQL\]/i, '').replace(/\[\/SQL\]$/i, '').trim();

    // If it somehow returned JSON array/object, extract it
    if (cleaned.startsWith('[') || cleaned.startsWith('{')) {
      try {
        const parsed: unknown = JSON.parse(cleaned);
        if (isUnknownArray(parsed) && parsed.length > 0) {
          const firstItem = parsed[0];
          if (isRecord(firstItem) && typeof firstItem.sql === 'string') {
            cleaned = firstItem.sql;
          }
        } else if (isRecord(parsed) && typeof parsed.sql === 'string') {
          cleaned = parsed.sql;
        }
      } catch {
        // ignore malformed structured output
      }
    }

    return cleaned;
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

    const model = this.config.model ?? 'gemini-2.5-flash';

    let response;
    let lastErr;
    for (let attempt = 0; attempt < 5; attempt++) {
      try {
        response = await this.ai.models.generateContent({
          model,
          contents: prompt,
          config: {
            temperature: 0.3,
            responseMimeType: 'application/json',
          },
        });
        break;
      } catch (err: any) {
        lastErr = err;
        if (err?.status === 429 || err?.message?.includes('429') || err?.message?.includes('Quota exceeded')) {
          const match = err.message.match(/retry in ([\d\.]+)s/i);
          const delayMs = match ? Math.ceil(parseFloat(match[1]) * 1000) + 1000 : 15000;
          console.warn(`[GeminiProvider] Rate limited (429). Retrying in ${delayMs}ms...`);
          await new Promise(r => setTimeout(r, delayMs));
          continue;
        }
        throw err;
      }
    }
    if (!response) throw lastErr;

    const responseText: unknown = response.text;
    const content = typeof responseText === 'string' ? responseText.trim() : '{}';
    try {
      const parsed: unknown = JSON.parse(content);
      const answer = isRecord(parsed) && typeof parsed.answer === 'string' ? parsed.answer : undefined;
      const parsedChart = isRecord(parsed) ? parsed.chart : undefined;
      const chart = isChartConfig(parsedChart) ? parsedChart : undefined;
      return {
        answer: answer || 'No answer generated.',
        chart,
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

    const model = this.config.model ?? 'gemini-2.5-flash';

    const stream = await this.ai.models.generateContentStream({
      model,
      contents: prompt,
      config: {
        temperature: 0.3,
      },
    });

    let fullText = '';
    
    for await (const chunk of stream) {
      const content = typeof chunk.text === 'string' ? chunk.text : '';
      if (content) {
        fullText += content;
        if (!fullText.includes('```json')) {
          yield { content };
        }
      }
    }
    
    const chartMatch = fullText.match(/```json\s*([\s\S]*?)\s*```/i);
    if (chartMatch && chartMatch[1]) {
      try {
        const parsed: unknown = JSON.parse(chartMatch[1]);
        if (isChartConfig(parsed)) {
          yield { chart: parsed };
        }
      } catch {
        // Ignore chart parse errors
      }
    }
    
    yield { done: true };
  }

  async dispose(): Promise<void> {
    // No persistent connections
  }
}
