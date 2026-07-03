/**
 * @digitalchokro/provider-openai — OpenAI AI Provider
 *
 * Uses the official OpenAI SDK to talk to GPT models.
 *
 * v0 stub — full implementation in Milestone 2.
 */

import type { AIProvider, RelevantSchema } from '@digitalchokro/core';
import OpenAI from 'openai';

export interface OpenAIProviderConfig {
  /** OpenAI API key. Falls back to OPENAI_API_KEY env var. */
  apiKey?: string;
  /** The model to use (e.g., 'gpt-4o'). See docs/RECOMMENDED_MODELS.md. */
  model?: string;
  /** Request timeout in milliseconds. Default: 30_000. */
  timeoutMs?: number;
}

export class OpenAIProvider implements AIProvider {
  readonly name = 'openai';

  private config: OpenAIProviderConfig;
  private client: OpenAI;

  constructor(config: OpenAIProviderConfig = {}) {
    this.config = config;
    this.client = new OpenAI({
      apiKey: config.apiKey, // defaults to process.env.OPENAI_API_KEY
      timeout: config.timeoutMs ?? 30_000,
    });
  }

  async generateSQL(prompt: string, _schema: RelevantSchema): Promise<string> {
    const model = this.config.model ?? 'gpt-4o';
    
    const response = await this.client.chat.completions.create({
      model,
      messages: [{ role: 'user', content: prompt }],
      temperature: 0, // Deterministic for SQL
    });

    const content = response.choices[0]?.message?.content || '';
    
    // Extract SQL from markdown code block if present
    const sqlMatch = content.match(/```sql\s*([\s\S]*?)\s*```/i) || content.match(/```\s*([\s\S]*?)\s*```/);
    return sqlMatch && sqlMatch[1] ? sqlMatch[1].trim() : content.trim();
  }

  async formatResponse(
    question: string,
    sql: string,
    rows: Record<string, unknown>[],
  ): Promise<{ answer: string; chart?: import('@digitalchokro/core').ChartConfig }> {
    const prompt = `You are a helpful data assistant. 
The user asked: "${question}"
I ran this SQL query to find the answer:
\`\`\`sql
${sql}
\`\`\`
The database returned these rows:
${JSON.stringify(rows, null, 2)}

Provide a clear, concise, natural-language answer to the user's question based ONLY on the data above.
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

    const response = await this.client.chat.completions.create({
      model,
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.3,
      response_format: { type: 'json_object' },
    });

    const content = response.choices[0]?.message?.content || '{}';
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
