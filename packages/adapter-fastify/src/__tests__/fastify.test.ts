import { describe, it, expect, vi, beforeEach } from 'vitest';
import Fastify from 'fastify';
import type { AskResult } from '@digitalchokro/core';
import { createAskChokroPlugin } from '../index.js';

describe('Adapter: Fastify', () => {
  let mockAgent: any;

  beforeEach(() => {
    mockAgent = {
      ask: vi.fn().mockResolvedValue({
        answer: 'Test answer',
        sql: 'SELECT 1',
        rows: [{ 1: 1 }],
        executionMs: 10,
        tokenUsage: { input: 10, output: 10 },
        retryCount: 0
      } as AskResult),
      stream: vi.fn().mockImplementation(async function* () {
        yield { content: 'Test ' };
        yield { content: 'stream' };
        yield { done: true, metadata: { sql: 'SELECT 1', rows: [], executionMs: 5, tokenUsage: { input: 5, output: 5 }, retryCount: 0 } };
      })
    };
  });

  it('handles /api/ask successfully', async () => {
    const fastify = Fastify();
    fastify.register(createAskChokroPlugin(mockAgent));

    const response = await fastify.inject({
      method: 'POST',
      url: '/api/ask',
      payload: { question: 'Hello' }
    });

    expect(response.statusCode).toBe(200);
    expect(JSON.parse(response.payload)).toMatchObject({
      answer: 'Test answer',
      sql: 'SELECT 1'
    });
    expect(mockAgent.ask).toHaveBeenCalledWith('Hello', {});
  });

  it('rejects /api/ask without question', async () => {
    const fastify = Fastify();
    fastify.register(createAskChokroPlugin(mockAgent));

    const response = await fastify.inject({
      method: 'POST',
      url: '/api/ask',
      payload: {}
    });

    expect(response.statusCode).toBe(400);
    expect(JSON.parse(response.payload).error.code).toBe('BAD_REQUEST');
  });

  it('handles /api/ask/stream successfully', async () => {
    const fastify = Fastify();
    fastify.register(createAskChokroPlugin(mockAgent));

    const response = await fastify.inject({
      method: 'POST',
      url: '/api/ask/stream',
      payload: { question: 'Hello' }
    });

    expect(response.statusCode).toBe(200);
    expect(response.headers['content-type']).toBe('text/event-stream');
    
    const text = response.payload;
    expect(text).toContain('data: {"content":"Test "}');
    expect(text).toContain('data: {"content":"stream"}');
    expect(text).toContain('data: {"done":true');
  });

  it('handles streaming errors gracefully', async () => {
    mockAgent.stream = vi.fn().mockImplementation(async function* () {
      throw new Error('Stream failed');
    });

    const fastify = Fastify();
    fastify.register(createAskChokroPlugin(mockAgent));

    const response = await fastify.inject({
      method: 'POST',
      url: '/api/ask/stream',
      payload: { question: 'Hello' }
    });

    // Error is thrown before headers sent, should be 500
    expect(response.statusCode).toBe(500);
    expect(JSON.parse(response.payload).error.message).toBe('Stream failed');
  });
});
