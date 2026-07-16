/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-return, @typescript-eslint/unbound-method, @typescript-eslint/explicit-function-return-type, @typescript-eslint/no-unnecessary-type-assertion */
/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-return, @typescript-eslint/unbound-method, @typescript-eslint/explicit-function-return-type, @typescript-eslint/no-unnecessary-type-assertion */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { VertexProvider } from './index.js';
import { VertexAI } from '@google-cloud/vertexai';

// Mock the entire @google-cloud/vertexai module
vi.mock('@google-cloud/vertexai', () => {
  const mockGenerateContent = vi.fn();
  const mockGenerateContentStream = vi.fn();
  const mockGetGenerativeModel = vi.fn(() => ({
    generateContent: mockGenerateContent,
    generateContentStream: mockGenerateContentStream,
  }));

  return {
    VertexAI: vi.fn(function MockVertexAI() {
      return { getGenerativeModel: mockGetGenerativeModel };
    }),
  };
});

/** Helper to get the mock generateContent from the VertexAI singleton */
function getMockFunctions() {
  const instance = (VertexAI as ReturnType<typeof vi.fn>).mock.results.at(-1)?.value;
  const model = instance?.getGenerativeModel();
  return {
    generateContent: model?.generateContent as ReturnType<typeof vi.fn>,
    generateContentStream: model?.generateContentStream as ReturnType<typeof vi.fn>,
  };
}

describe('VertexProvider', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.GOOGLE_CLOUD_PROJECT = 'test-project';
  });

  describe('Initialization', () => {
    it('instantiates correctly when project is provided via env', () => {
      const provider = new VertexProvider();
      expect(provider).toBeInstanceOf(VertexProvider);
      expect(provider.name).toBe('vertex');
      expect(VertexAI).toHaveBeenCalledWith({
        project: 'test-project',
        location: 'us-central1',
      });
    });

    it('uses custom project and location if provided', () => {
      new VertexProvider({ project: 'my-project', location: 'europe-west4' });
      expect(VertexAI).toHaveBeenCalledWith({
        project: 'my-project',
        location: 'europe-west4',
      });
    });

    it('throws if no project is available', () => {
      delete process.env.GOOGLE_CLOUD_PROJECT;
      delete process.env.GCLOUD_PROJECT;
      expect(() => new VertexProvider()).toThrow(/requires a GCP project ID/);
    });
  });

  describe('generateSQL', () => {
    it('calls the model and cleans SQL from markdown code block', async () => {
      const provider = new VertexProvider({ project: 'test-project' });
      const { generateContent } = getMockFunctions();

      generateContent.mockResolvedValueOnce({
        response: {
          candidates: [{ content: { parts: [{ text: '```sql\nSELECT * FROM users;\n```' }] } }],
        },
      });

      const result = await provider.generateSQL('How many users?', { tables: [], selectionReason: '' });
      expect(result).toBe('SELECT * FROM users;');
    });

    it('strips [SQL] tags', async () => {
      const provider = new VertexProvider({ project: 'test-project' });
      const { generateContent } = getMockFunctions();

      generateContent.mockResolvedValueOnce({
        response: { candidates: [{ content: { parts: [{ text: '[SQL]SELECT 1;[/SQL]' }] } }] },
      });

      const result = await provider.generateSQL('prompt', { tables: [], selectionReason: '' });
      expect(result).toBe('SELECT 1;');
    });

    it('uses gemini-2.5-pro by default', async () => {
      const provider = new VertexProvider({ project: 'test-project' });
      const instance = (VertexAI as ReturnType<typeof vi.fn>).mock.results.at(-1)?.value;

      const { generateContent } = getMockFunctions();
      generateContent.mockResolvedValueOnce({
        response: { candidates: [{ content: { parts: [{ text: 'SELECT 1' }] } }] },
      });

      await provider.generateSQL('q', { tables: [], selectionReason: '' });
      expect(instance.getGenerativeModel).toHaveBeenCalledWith(
        expect.objectContaining({ model: 'gemini-2.5-pro' })
      );
    });
  });

  describe('formatResponse', () => {
    it('parses JSON answer and chart config', async () => {
      const provider = new VertexProvider({ project: 'test-project' });
      const { generateContent } = getMockFunctions();

      const jsonPayload = JSON.stringify({
        answer: 'You have 42 users.',
        chart: { type: 'bar', xAxisKey: 'month', yAxisKeys: ['count'] },
      });

      generateContent.mockResolvedValueOnce({
        response: { candidates: [{ content: { parts: [{ text: jsonPayload }] } }] },
      });

      const result = await provider.formatResponse('question', 'SELECT COUNT(*) FROM users', []);
      expect(result.answer).toBe('You have 42 users.');
      expect(result.chart?.type).toBe('bar');
      expect(result.chart?.xAxisKey).toBe('month');
    });

    it('falls back to raw text on JSON parse failure', async () => {
      const provider = new VertexProvider({ project: 'test-project' });
      const { generateContent } = getMockFunctions();

      generateContent.mockResolvedValueOnce({
        response: { candidates: [{ content: { parts: [{ text: '{ bad json' }] } }] },
      });

      const result = await provider.formatResponse('q', 's', []);
      expect(result.answer).toBe('{ bad json');
    });
  });

  describe('streamResponse', () => {
    it('yields text chunks and done signal', async () => {
      const provider = new VertexProvider({ project: 'test-project' });
      const { generateContentStream } = getMockFunctions();

      const chunks = [
        { candidates: [{ content: { parts: [{ text: 'Hello ' }] } }] },
        { candidates: [{ content: { parts: [{ text: 'world!' }] } }] },
      ];

      generateContentStream.mockResolvedValueOnce({
        stream: (async function* () { for (const c of chunks) yield c; })(),
      });

      const results: unknown[] = [];
      for await (const chunk of provider.streamResponse('q', 'SELECT 1', [])) {
        results.push(chunk);
      }

      expect(results).toContainEqual({ content: 'Hello ' });
      expect(results).toContainEqual({ content: 'world!' });
      expect(results).toContainEqual({ done: true });
    });

    it('extracts chart config from trailing json block', async () => {
      const provider = new VertexProvider({ project: 'test-project' });
      const { generateContentStream } = getMockFunctions();

      const chartJson = '{ "type": "line", "xAxisKey": "month", "yAxisKeys": ["revenue"] }';
      const chunks = [
        { candidates: [{ content: { parts: [{ text: 'Here is the data. ' }] } }] },
        { candidates: [{ content: { parts: [{ text: `\`\`\`json\n${chartJson}\n\`\`\`` }] } }] },
      ];

      generateContentStream.mockResolvedValueOnce({
        stream: (async function* () { for (const c of chunks) yield c; })(),
      });

      const results: unknown[] = [];
      for await (const chunk of provider.streamResponse('q', 'SELECT 1', [])) {
        results.push(chunk);
      }

      expect(results).toContainEqual({
        chart: { type: 'line', xAxisKey: 'month', yAxisKeys: ['revenue'] },
      });
    });
  });
});
