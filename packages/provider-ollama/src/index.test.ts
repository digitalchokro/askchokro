/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-return, @typescript-eslint/unbound-method, @typescript-eslint/explicit-function-return-type, @typescript-eslint/no-unnecessary-type-assertion */
/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-return, @typescript-eslint/unbound-method, @typescript-eslint/explicit-function-return-type, @typescript-eslint/no-unnecessary-type-assertion */
import { describe, it, expect, beforeEach, vi, type MockInstance, afterEach } from 'vitest';
import { OllamaProvider } from './index';

describe('OllamaProvider', () => {
  let fetchMock: MockInstance;

  beforeEach(() => {
    fetchMock = vi.spyOn(global, 'fetch');
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Initialization', () => {
    it('throws error if model is not provided', () => {
      expect(() => new (OllamaProvider as any)({})).toThrow('requires a model name');
    });

    it('instantiates correctly with required config', () => {
      const provider = new OllamaProvider({ model: 'llama3' });
      expect(provider).toBeInstanceOf(OllamaProvider);
      expect(provider.name).toBe('ollama');
    });
  });

  describe('generateSQL', () => {
    it('sends prompt to localhost:11434 and extracts SQL', async () => {
      const provider = new OllamaProvider({ model: 'llama3' });
      
      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ response: '```sql\nSELECT 1;\n```' })
      } as any);

      const result = await provider.generateSQL('my prompt', { tables: [], selectionReason: '' });
      expect(fetchMock).toHaveBeenCalledWith('http://localhost:11434/api/generate', expect.objectContaining({
        method: 'POST',
        body: expect.stringContaining('my prompt')
      }));
      expect(result).toBe('SELECT 1;');
    });

    it('throws on HTTP error', async () => {
      const provider = new OllamaProvider({ model: 'llama3' });
      
      fetchMock.mockResolvedValueOnce({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error'
      } as any);

      await expect(provider.generateSQL('prompt', { tables: [], selectionReason: '' })).rejects.toThrow('500');
    });
  });

  describe('formatResponse', () => {
    it('extracts structured data from JSON response', async () => {
      const provider = new OllamaProvider({ model: 'llama3' });
      
      const jsonResponse = JSON.stringify({ answer: 'The answer', chart: { type: 'bar' } });
      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ response: jsonResponse })
      } as any);

      const result = await provider.formatResponse('question', 'SELECT 1', []);
      expect(result.answer).toBe('The answer');
      expect(result.chart?.type).toBe('bar');
    });

    it('falls back to raw text if JSON is invalid', async () => {
      const provider = new OllamaProvider({ model: 'llama3' });
      
      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ response: '{ invalid json' })
      } as any);

      const result = await provider.formatResponse('q', 's', []);
      expect(result.answer).toBe('{ invalid json');
    });
  });
});
