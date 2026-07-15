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

  describe('formatResponse', () => {
    it('extracts structured data from response', async () => {
      const provider = new AnthropicProvider({ apiKey: 'test' });
      const mockCreate = (new Anthropic() as any).messages.create;
      
      const jsonResponse = JSON.stringify({ answer: 'The answer', chart: { type: 'bar' } });
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
