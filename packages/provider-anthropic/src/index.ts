import type { AIProvider, RelevantSchema } from '@askchokro/core';
import Anthropic from '@anthropic-ai/sdk';

export interface AnthropicProviderConfig {
  /** Anthropic API Key */
  apiKey: string;
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

      const responseText = (msg.content[0] as any).text.trim();
      return this.cleanSQL(responseText);
    } catch (err) {
      throw new Error(`[AskChokro Anthropic] Failed to generate SQL: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  async formatResponse(question: string, sql: string, rows: object[]): Promise<string> {
    const systemPrompt = `You are a helpful data analyst. 
The user asked a question, a SQL query was executed, and the database returned rows.
Answer the user's question accurately in natural language based on the data.
Be concise. Do not explain the SQL query.`;

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

      return (msg.content[0] as any).text.trim();
    } catch (err) {
      throw new Error(`[AskChokro Anthropic] Failed to format response: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  private cleanSQL(sql: string): string {
    return sql
      .replace(/^\`\`\`sql/i, '')
      .replace(/^\`\`\`/i, '')
      .replace(/\`\`\`$/i, '')
      .trim();
  }
}
