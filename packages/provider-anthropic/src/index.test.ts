/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-return, @typescript-eslint/unbound-method, @typescript-eslint/explicit-function-return-type, @typescript-eslint/no-unnecessary-type-assertion */
/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-return, @typescript-eslint/unbound-method, @typescript-eslint/explicit-function-return-type, @typescript-eslint/no-unnecessary-type-assertion */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { AnthropicProvider } from './index';
import Anthropic from '@anthropic-ai/sdk';

// Mock Anthropic
vi.mock('@anthropic-ai/sdk', () => {
  const mockCreate = vi.fn();
  return {
    default: vi.fn(function MockAnthropic() {
      return {
        messages: {
          create: mockCreate
        }
      };
    })
  };
});

describe('AnthropicProvider', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Initialization', () => {
    it('instantiates correctly when API key is provided', () => {
      const provider = new AnthropicProvider({ apiKey: 'test-key' });
      expect(provider).toBeInstanceOf(AnthropicProvider);
      expect(provider.name).toBe('anthropic');
      expect(Anthropic).toHaveBeenCalledWith(expect.objectContaining({ apiKey: 'test-key' }));
    });
  });

  describe('generateSQL', () => {
    it('formats prompt and schema and returns extracted SQL', async () => {
      const provider = new AnthropicProvider({ apiKey: 'test' });
      const mockCreate = (new Anthropic() as any).messages.create;
      
      mockCreate.mockResolvedValueOnce({
        content: [{ text: '```sql\nSELECT 1;\n```' }]
      });

      const result = await provider.generateSQL('my prompt', { tables: [], selectionReason: '' });
      expect(mockCreate).toHaveBeenCalledWith(expect.objectContaining({
        messages: [{ role: 'user', content: 'my prompt' }]
      }));
      expect(result).toBe('SELECT 1;');
    });

    it('throws error if API call fails', async () => {
      const provider = new AnthropicProvider({ apiKey: 'test' });
      const mockCreate = (new Anthropic() as any).messages.create;

      mockCreate.mockRejectedValueOnce(new Error('Anthropic Error'));
      await expect(provider.generateSQL('prompt', { tables: [], selectionReason: '' })).rejects.toThrow('Anthropic Error');
    });
  });

  // Token accounting is instrumentation. Reading it must not be able to turn a
  // successful generation into a thrown error, which is what an unguarded
  // `msg.usage.input_tokens` did for any response that omitted the block.
  describe('token usage', () => {
    it('accumulates usage and drains it on read', async () => {
      const provider = new AnthropicProvider({ apiKey: 'test' });
      const mockCreate = (new Anthropic() as any).messages.create;

      mockCreate.mockResolvedValueOnce({
        content: [{ text: 'SELECT 1;' }],
        usage: { input_tokens: 30, output_tokens: 9 },
      });

      await provider.generateSQL('prompt', { tables: [], selectionReason: '' });
      expect(provider.consumeUsage?.()).toEqual({ input: 30, output: 9 });
      expect(provider.consumeUsage?.()).toEqual({ input: 0, output: 0 });
    });

    it('still returns SQL when the response has no usage block', async () => {
      const provider = new AnthropicProvider({ apiKey: 'test' });
      const mockCreate = (new Anthropic() as any).messages.create;

      mockCreate.mockResolvedValueOnce({ content: [{ text: 'SELECT 1;' }] });

      await expect(
        provider.generateSQL('prompt', { tables: [], selectionReason: '' }),
      ).resolves.toBe('SELECT 1;');
      expect(provider.consumeUsage?.()).toEqual({ input: 0, output: 0 });
    });

    it('still formats a response that has no usage block', async () => {
      const provider = new AnthropicProvider({ apiKey: 'test' });
      const mockCreate = (new Anthropic() as any).messages.create;

      mockCreate.mockResolvedValueOnce({
        content: [{ text: JSON.stringify({ answer: 'Fine.' }) }],
      });

      const result = await provider.formatResponse('q', 'SELECT 1', []);
      expect(result.answer).toBe('Fine.');
    });
  });

  describe('formatResponse', () => {
    it('extracts structured data from response', async () => {
      const provider = new AnthropicProvider({ apiKey: 'test' });
      const mockCreate = (new Anthropic() as any).messages.create;
      
      const jsonResponse = JSON.stringify({ answer: 'The answer', chart: { type: 'bar', xAxisKey: 'month', yAxisKeys: ['revenue'] } });
      mockCreate.mockResolvedValueOnce({
        content: [{ text: jsonResponse }]
      });

      const result = await provider.formatResponse('question', 'SELECT 1', []);
      expect(result.answer).toBe('The answer');
      expect(result.chart?.type).toBe('bar');
    });

    it('falls back to raw text if JSON is invalid', async () => {
      const provider = new AnthropicProvider({ apiKey: 'test' });
      const mockCreate = (new Anthropic() as any).messages.create;
      
      mockCreate.mockResolvedValueOnce({
        content: [{ text: '{ invalid json' }]
      });

      const result = await provider.formatResponse('q', 's', []);
      expect(result.answer).toBe('{ invalid json');
    });
  });
});
