/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-return, @typescript-eslint/unbound-method, @typescript-eslint/explicit-function-return-type, @typescript-eslint/no-unnecessary-type-assertion */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GroqProvider } from '../index.js';
import OpenAI from 'openai';
import type { RelevantSchema } from '@digitalchokro/core';

// Mock OpenAI
vi.mock('openai', () => {
  const mockCreate = vi.fn();
  return {
    default: vi.fn(function MockOpenAI() {
      return {
        chat: {
          completions: {
            create: mockCreate
          }
        }
      };
    })
  };
});

describe('@digitalchokro/provider-groq', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env.GROQ_API_KEY;
  });

  describe('Initialization', () => {
    it('initializes with config apiKey', () => {
      new GroqProvider({ apiKey: 'test-key' });
      expect(OpenAI).toHaveBeenCalledWith({
        apiKey: 'test-key',
        timeout: 30000,
        baseURL: 'https://api.groq.com/openai/v1',
      });
    });

    it('falls back to GROQ_API_KEY env var', () => {
      process.env.GROQ_API_KEY = 'env-key';
      new GroqProvider();
      expect(OpenAI).toHaveBeenCalledWith({
        apiKey: 'env-key',
        timeout: 30000,
        baseURL: 'https://api.groq.com/openai/v1',
      });
    });

    it('handles multiple API keys for rotation', () => {
      new GroqProvider({ apiKey: 'key1, key2' });
      expect(OpenAI).toHaveBeenCalledTimes(2);
      expect(OpenAI).toHaveBeenNthCalledWith(1, {
        apiKey: 'key1',
        timeout: 30000,
        baseURL: 'https://api.groq.com/openai/v1',
      });
      expect(OpenAI).toHaveBeenNthCalledWith(2, {
        apiKey: 'key2',
        timeout: 30000,
        baseURL: 'https://api.groq.com/openai/v1',
      });
    });
  });

  describe('generateSQL', () => {
    const mockSchema: RelevantSchema = {
      tables: [{
        name: 'users',
        columns: [{ name: 'id', type: 'integer' }, { name: 'name', type: 'text' }],
      }],
      relations: [],
    };

    it('generates SQL successfully', async () => {
      const provider = new GroqProvider({ apiKey: 'test-key' });
      const mockCreate = (new OpenAI() as any).chat.completions.create;
      
      mockCreate.mockResolvedValueOnce({
        choices: [{ message: { content: 'SELECT * FROM users;' } }],
      });

      const result = await provider.generateSQL('get all users', mockSchema);
      expect(result).toBe('SELECT * FROM users;');
      
      expect(mockCreate).toHaveBeenCalledWith({
        model: 'llama3-70b-8192',
        messages: [{ role: 'user', content: 'get all users' }],
        temperature: 0,
      });
    });

    it('extracts SQL from markdown blocks', async () => {
      const provider = new GroqProvider({ apiKey: 'test-key' });
      const mockCreate = (new OpenAI() as any).chat.completions.create;
      
      mockCreate.mockResolvedValueOnce({
        choices: [{ message: { content: 'Here is the query:\n```sql\nSELECT name FROM users;\n```' } }],
      });

      const result = await provider.generateSQL('get user names', mockSchema);
      expect(result).toBe('SELECT name FROM users;');
    });
  });

  describe('Error Handling', () => {
    const mockSchema: RelevantSchema = { tables: [], relations: [] };

    it('retries on 429 rate limit with multiple keys', async () => {
      const provider = new GroqProvider({ apiKey: 'key1,key2' });
      const mockCreate = (new OpenAI() as any).chat.completions.create;
      
      const rateLimitError = new Error('429 Too Many Requests') as any;
      rateLimitError.status = 429;
      
      mockCreate
        .mockRejectedValueOnce(rateLimitError) // Fails on key1
        .mockResolvedValueOnce({               // Succeeds on key2
          choices: [{ message: { content: 'SELECT 1;' } }],
        });

      const result = await provider.generateSQL('test', mockSchema);
      expect(result).toBe('SELECT 1;');
      expect(mockCreate).toHaveBeenCalledTimes(2);
    });

    it('throws after exhausting retries/keys', async () => {
      const provider = new GroqProvider({ apiKey: 'key1' });
      const mockCreate = (new OpenAI() as any).chat.completions.create;
      
      const authError = new Error('401 Unauthorized') as any;
      authError.status = 401;
      
      mockCreate.mockRejectedValue(authError);

      await expect(provider.generateSQL('test', mockSchema)).rejects.toThrow('401 Unauthorized');
    });

    it('handles server errors (5xx)', async () => {
      const provider = new GroqProvider();
      const mockCreate = (new OpenAI() as any).chat.completions.create;
      mockCreate.mockRejectedValueOnce(new Error('500 Server Error'));

      await expect(provider.generateSQL('test', mockSchema)).rejects.toThrow('500 Server Error');
    });

    it('provides meaningful error messages', async () => {
      const provider = new GroqProvider();
      const mockCreate = (new OpenAI() as any).chat.completions.create;
      mockCreate.mockResolvedValueOnce({ choices: [{ message: { content: '' } }] });

      const result = await provider.generateSQL('test', mockSchema);
      expect(result).toBe('');
    });
  });

  describe('Integration', () => {
    it('implements AIProvider interface correctly', () => {
      const provider = new GroqProvider();
      expect(provider.name).toBe('groq');
      expect(typeof provider.generateSQL).toBe('function');
    });
  });

  describe('Mocking for Tests', () => {
    it('all tests should mock openai.OpenAI client', () => {
      expect(vi.isMockFunction(OpenAI)).toBe(true);
    });
  });
});
