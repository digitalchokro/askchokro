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
  ): Promise<string> {
    const prompt = `You are a helpful data assistant. 
The user asked: "${question}"
I ran this SQL query to find the answer:
\`\`\`sql
${sql}
\`\`\`
The database returned these rows:
${JSON.stringify(rows, null, 2)}

Provide a clear, concise, natural-language answer to the user's question based ONLY on the data above. Do not expose the SQL query unless necessary.`;

    const model = this.config.model ?? 'gemini-2.5-flash';

    const response = await this.ai.models.generateContent({
      model,
      contents: prompt,
      config: {
        temperature: 0.3,
      }
    });

    return response.text?.trim() || '';
  }

  async dispose(): Promise<void> {
    // No persistent connections
  }
}
