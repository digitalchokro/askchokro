/**
 * @digitalchokro/provider-vertex — Google Vertex AI Provider
 *
 * Implements the AIProvider interface using the @google-cloud/vertexai SDK.
 * Best suited for GCP-native and enterprise deployments where you need
 * service account authentication and project-scoped access controls.
 *
 * Authentication:
 *   - Set GOOGLE_APPLICATION_CREDENTIALS env var pointing to a service account JSON, OR
 *   - Run inside a GCP environment (Cloud Run, GCE) for automatic ADC.
 *
 * For CI/CD (GitHub Actions), configure GEMINI_API_KEY or use Workload Identity Federation.
 */

import type { AIProvider, RelevantSchema, VectorSearchResult, ChartConfig } from '@digitalchokro/core';
import { VertexAI, type GenerateContentResult, type StreamGenerateContentResult } from '@google-cloud/vertexai';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isChartConfig(value: unknown): value is ChartConfig {
  if (!isRecord(value)) return false;
  return (
    (value.type === 'bar' || value.type === 'line' || value.type === 'pie') &&
    typeof value.xAxisKey === 'string' &&
    Array.isArray(value.yAxisKeys) &&
    (value.yAxisKeys as unknown[]).every(k => typeof k === 'string')
  );
}

export interface VertexProviderConfig {
  /** GCP project ID. Falls back to GOOGLE_CLOUD_PROJECT env var. */
  project?: string;
  /** GCP region. Defaults to 'us-central1'. */
  location?: string;
  /**
   * The Vertex AI model to use.
   * Defaults to 'gemini-2.5-pro' — the enterprise-grade model.
   * Use 'gemini-2.5-flash' for faster, lower-cost inference.
   */
  model?: string;
}

export class VertexProvider implements AIProvider {
  readonly name = 'vertex';

  private config: VertexProviderConfig;
  private vertex: VertexAI;

  constructor(config: VertexProviderConfig = {}) {
    const project = config.project ?? process.env.GOOGLE_CLOUD_PROJECT ?? process.env.GCLOUD_PROJECT;
    if (!project) {
      throw new Error(
        '[AskChokro] VertexProvider requires a GCP project ID. ' +
        'Set the `project` option or the GOOGLE_CLOUD_PROJECT environment variable.',
      );
    }

    this.config = { ...config, project };
    this.vertex = new VertexAI({
      project,
      location: config.location ?? 'us-central1',
    });
  }

  async generateSQL(prompt: string, _schema: RelevantSchema): Promise<string> {
    const modelName = this.config.model ?? 'gemini-2.5-pro';
    const model = this.vertex.getGenerativeModel({
      model: modelName,
      generationConfig: { temperature: 0 },
    });

    const result: GenerateContentResult = await model.generateContent(prompt);
    const content = result.response.candidates?.[0]?.content?.parts?.[0]?.text ?? '';

    let cleaned = content.trim();
    const sqlMatch = cleaned.match(/```sql\s*([\s\S]*?)\s*```/i) || cleaned.match(/```\s*([\s\S]*?)\s*```/);
    if (sqlMatch?.[1]) cleaned = sqlMatch[1].trim();

    cleaned = cleaned.replace(/^\[SQL\]/i, '').replace(/\[\/SQL\]$/i, '').trim();
    return cleaned;
  }

  async formatResponse(
    question: string,
    sql: string,
    rows: Record<string, unknown>[],
    ragContext?: VectorSearchResult[],
  ): Promise<{ answer: string; chart?: ChartConfig }> {
    let contextText = '';

    if (ragContext && ragContext.length > 0) {
      contextText += `\nUnstructured Documentation Context:\n${ragContext.map((r, i) => `[Doc ${i + 1}] ${r.text}`).join('\n\n')}\n`;
    }

    if (sql && sql !== "SELECT 'CANNOT_ANSWER' AS error") {
      contextText += `\nI ran this SQL query:\n\`\`\`sql\n${sql}\n\`\`\`\nThe database returned:\n${JSON.stringify(rows, null, 2)}\n`;
    }

    const prompt = `You are a helpful data assistant.
The user asked: "${question}"
${contextText}
Provide a clear, concise, natural-language answer based ONLY on the data above.

CRITICAL LANGUAGE RULE: Reply in the exact same language the user used.

If the data represents a time-series, comparison, or categorical breakdown, include a chart config.
Respond in pure JSON:
{
  "answer": "Your text answer here.",
  "chart": { "type": "bar", "xAxisKey": "month", "yAxisKeys": ["revenue"] }
}
If no chart is needed, omit the "chart" field.`;

    const modelName = this.config.model ?? 'gemini-2.5-pro';
    const model = this.vertex.getGenerativeModel({
      model: modelName,
      generationConfig: {
        temperature: 0.3,
        responseMimeType: 'application/json',
      },
    });

    const result: GenerateContentResult = await model.generateContent(prompt);
    const content = result.response.candidates?.[0]?.content?.parts?.[0]?.text?.trim() ?? '{}';

    try {
      const parsed: unknown = JSON.parse(content);
      const answer = isRecord(parsed) && typeof parsed.answer === 'string' ? parsed.answer : undefined;
      const chart = isChartConfig(isRecord(parsed) ? parsed.chart : undefined) 
        ? (parsed as Record<string, unknown>).chart as ChartConfig 
        : undefined;
      return { answer: answer ?? 'No answer generated.', chart };
    } catch {
      return { answer: content };
    }
  }

  async *streamResponse(
    question: string,
    sql: string,
    rows: Record<string, unknown>[],
    ragContext?: VectorSearchResult[],
  ): AsyncIterable<{ content?: string; chart?: ChartConfig; done?: boolean }> {
    let contextText = '';

    if (ragContext && ragContext.length > 0) {
      contextText += `\nUnstructured Documentation Context:\n${ragContext.map((r, i) => `[Doc ${i + 1}] ${r.text}`).join('\n\n')}\n`;
    }

    if (sql && sql !== "SELECT 'CANNOT_ANSWER' AS error") {
      contextText += `\nI ran this SQL query:\n\`\`\`sql\n${sql}\n\`\`\`\nThe database returned:\n${JSON.stringify(rows, null, 2)}\n`;
    }

    const prompt = `You are a helpful data assistant.
The user asked: "${question}"
${contextText}
Provide a clear, concise, natural-language answer based ONLY on the data above.

CRITICAL LANGUAGE RULE: Reply in the exact same language the user used.

If the data represents a time-series, comparison, or categorical breakdown, append a chart config at the very end inside a JSON block:
\`\`\`json
{ "type": "bar", "xAxisKey": "month", "yAxisKeys": ["revenue"] }
\`\`\`
The chart type must be one of: 'bar', 'line', 'pie'.`;

    const modelName = this.config.model ?? 'gemini-2.5-pro';
    const model = this.vertex.getGenerativeModel({
      model: modelName,
      generationConfig: { temperature: 0.3 },
    });

    const stream: StreamGenerateContentResult = await model.generateContentStream(prompt);

    let fullText = '';

    for await (const chunk of stream.stream) {
      const text = chunk.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
      if (text) {
        fullText += text;
        if (!fullText.includes('```json')) {
          yield { content: text };
        }
      }
    }

    // Parse optional chart from the final ```json block
    const chartMatch = fullText.match(/```json\s*([\s\S]*?)\s*```/i);
    if (chartMatch?.[1]) {
      try {
        const parsed: unknown = JSON.parse(chartMatch[1]);
        if (isChartConfig(parsed)) yield { chart: parsed };
      } catch {
        // Silently ignore invalid chart JSON
      }
    }

    yield { done: true };
  }

  async dispose(): Promise<void> {
    // VertexAI SDK has no persistent connections to close
  }
}
