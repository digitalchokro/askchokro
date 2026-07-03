/**
 * @digitalchokro/provider-gemini — Google Gemini AI Provider
 *
 * Uses the official @google/genai SDK to talk to Gemini models.
 */

import type { AIProvider, RelevantSchema } from '@digitalchokro/core';
import { GoogleGenAI } from '@google/genai';

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
    
    const response = await this.ai.models.generateContent({
      model,
      contents: prompt,
      config: {
        temperature: 0, // Deterministic for SQL
      }
    });

    const content = response.text || '';
    
    // Extract SQL from markdown code block if present
    const sqlMatch = content.match(/```sql\s*([\s\S]*?)\s*```/i) || content.match(/```\s*([\s\S]*?)\s*```/);
    return sqlMatch && sqlMatch[1] ? sqlMatch[1].trim() : content.trim();
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

    const response = await this.ai.models.generateContent({
      model,
      contents: prompt,
      config: {
        temperature: 0.3,
        responseMimeType: 'application/json',
      }
    });

    const content = response.text?.trim() || '{}';
    try {
      const parsed = JSON.parse(content) as { answer?: string, chart?: import('@digitalchokro/core').ChartConfig };
      return {
        answer: parsed.answer || 'No answer generated.',
        chart: parsed.chart || undefined,
      };
    } catch (e) {
      return { answer: content };
    }
  }

  async dispose(): Promise<void> {
    // No persistent connections
  }
}
