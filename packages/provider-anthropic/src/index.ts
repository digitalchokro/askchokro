import type { AIProvider, RelevantSchema } from '@digitalchokro/core';
import Anthropic from '@anthropic-ai/sdk';
import type { TextBlock } from '@anthropic-ai/sdk/resources/messages.js';

export interface AnthropicProviderConfig {
  /** Anthropic API Key */
  apiKey?: string;
  /** Model to use (default: claude-3-5-sonnet-20240620) */
  model?: string;
  /** Base URL for API (optional) */
  baseURL?: string;
}

export class AnthropicProvider implements AIProvider {
  readonly name = 'anthropic';
  private client: Anthropic;
  private model: string;

  constructor(config: AnthropicProviderConfig) {
    this.client = new Anthropic({
      apiKey: config.apiKey,
      baseURL: config.baseURL,
    });
    this.model = config.model || 'claude-3-5-sonnet-20240620';
  }

  async generateSQL(prompt: string, schema: RelevantSchema): Promise<string> {
    const systemPrompt = `You are an expert SQL generator.
Your ONLY job is to output raw SQL based on the user's question and the provided schema.
DO NOT output markdown formatting like \`\`\`sql.
DO NOT explain your answer.
DO NOT add any conversational text.
ONLY return the SQL statement.

Schema Context:
${JSON.stringify(schema, null, 2)}`;

    try {
      const msg = await this.client.messages.create({
        model: this.model,
        max_tokens: 1000,
        temperature: 0,
        system: systemPrompt,
        messages: [
          { role: 'user', content: prompt }
        ],
      });

      const firstBlock = msg.content[0] as TextBlock;
      return this.cleanSQL(firstBlock.text.trim());
    } catch (err) {
      throw new Error(`[AskChokro Anthropic] Failed to generate SQL: ${err instanceof Error ? err.message : String(err)}`);
    }
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

    const systemPrompt = `You are a helpful data assistant. 
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

    const userContent = `Question: ${question}
SQL Used: ${sql}
Data:
${JSON.stringify(rows, null, 2)}
`;

    try {
      const msg = await this.client.messages.create({
        model: this.model,
        max_tokens: 1000,
        temperature: 0,
        system: systemPrompt,
        messages: [
          { role: 'user', content: userContent }
        ],
      });

      const firstBlock = msg.content[0] as TextBlock;
      const content = firstBlock.text.trim();
      
      try {
        const parsed = JSON.parse(content) as { answer?: string, chart?: import('@digitalchokro/core').ChartConfig };
        return {
          answer: parsed.answer || 'No answer generated.',
          chart: parsed.chart || undefined,
        };
      } catch {
        return { answer: content };
      }
    } catch (err) {
      throw new Error(`[AskChokro Anthropic] Failed to format response: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  private cleanSQL(sql: string): string {
    return sql
      .replace(/^```sql/i, '')
      .replace(/^```/i, '')
      .replace(/```$/i, '')
      .trim();
  }
}
