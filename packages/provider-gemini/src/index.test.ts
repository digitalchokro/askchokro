import { describe, it, expect, beforeEach, vi } from 'vitest';
import { GeminiProvider } from './index';
import { GoogleGenAI } from '@google/genai';

// Mock GoogleGenAI
vi.mock('@google/genai', () => {
  const mockGenerateContent = vi.fn();
  return {
    GoogleGenAI: vi.fn(function MockGoogleGenAI() {
      return {
        models: {
          generateContent: mockGenerateContent
        }
      };
    })
  };
});

describe('GeminiProvider', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Initialization', () => {
    it('instantiates correctly when API key is provided', () => {
      const provider = new GeminiProvider({ apiKey: 'test-key' });
      expect(provider).toBeInstanceOf(GeminiProvider);
      expect(provider.name).toBe('gemini');
      expect(GoogleGenAI).toHaveBeenCalledWith(expect.objectContaining({ apiKey: 'test-key' }));
    });
  });

  describe('generateSQL', () => {
    it('formats prompt and extracts SQL from plain text response', async () => {
      const provider = new GeminiProvider({ apiKey: 'test' });
      const mockGenerateContent = (new GoogleGenAI() as any).models.generateContent;
      
      mockGenerateContent.mockResolvedValueOnce({
        text: '```sql\nSELECT 1;\n```'
      });

      const result = await provider.generateSQL('my prompt', { tables: [], selectionReason: '' });
      expect(mockGenerateContent).toHaveBeenCalledWith(expect.objectContaining({
        contents: 'my prompt',
        model: 'gemini-2.5-flash'
      }));
      expect(result).toBe('SELECT 1;');
    });

    it('extracts SQL when wrapped in [SQL] tags', async () => {
      const provider = new GeminiProvider({ apiKey: 'test' });
      const mockGenerateContent = (new GoogleGenAI() as any).models.generateContent;
      
      mockGenerateContent.mockResolvedValueOnce({
        text: '[SQL]SELECT * FROM users;[/SQL]'
      });

      const result = await provider.generateSQL('prompt', { tables: [], selectionReason: '' });
      expect(result).toBe('SELECT * FROM users;');
    });

    it('extracts SQL from unexpected structured JSON output', async () => {
      const provider = new GeminiProvider({ apiKey: 'test' });
      const mockGenerateContent = (new GoogleGenAI() as any).models.generateContent;
      
      mockGenerateContent.mockResolvedValueOnce({
        text: JSON.stringify({ sql: 'SELECT json;' })
      });

      const result = await provider.generateSQL('prompt', { tables: [], selectionReason: '' });
      expect(result).toBe('SELECT json;');
    });
  });

  describe('formatResponse', () => {
    it('extracts structured data from response', async () => {
      const provider = new GeminiProvider({ apiKey: 'test' });
      const mockGenerateContent = (new GoogleGenAI() as any).models.generateContent;
      
      const jsonResponse = JSON.stringify({ answer: 'The answer', chart: { type: 'pie', xAxisKey: 'a', yAxisKeys: ['b'] } });
      mockGenerateContent.mockResolvedValueOnce({
        text: jsonResponse
      });

      const result = await provider.formatResponse('question', 'SELECT 1', []);
      expect(result.answer).toBe('The answer');
      expect(result.chart?.type).toBe('pie');
    });

    it('falls back to raw text if JSON parsing fails completely', async () => {
      const provider = new GeminiProvider({ apiKey: 'test' });
      const mockGenerateContent = (new GoogleGenAI() as any).models.generateContent;
      
      mockGenerateContent.mockResolvedValueOnce({
        text: '{ invalid json'
      });

      const result = await provider.formatResponse('q', 's', []);
      expect(result.answer).toBe('{ invalid json');
    });
  });
});
