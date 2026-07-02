/**
 * @askchokro/provider-ollama — Ollama AI Provider
 *
 * Talks directly to the Ollama HTTP API (localhost:11434 by default).
 * Zero npm dependencies — uses native fetch().
 * Free, local, no API key required.
 *
 * v0 stub — full implementation in Milestone 2.
 */

import type { AIProvider, RelevantSchema } from '@askchokro/core';

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

    const response = await fetch(`${this.baseUrl}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: this.config.model,
        prompt: prompt,
        stream: false,
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
    return data.response.trim();
  }

  async dispose(): Promise<void> {
    // No persistent connections to clean up
  }
}
