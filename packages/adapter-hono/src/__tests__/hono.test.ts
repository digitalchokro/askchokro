/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-return, @typescript-eslint/unbound-method, @typescript-eslint/explicit-function-return-type, @typescript-eslint/no-unnecessary-type-assertion, @typescript-eslint/no-unused-vars, require-yield */
/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-return, @typescript-eslint/unbound-method, @typescript-eslint/explicit-function-return-type, @typescript-eslint/no-unnecessary-type-assertion */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Hono } from 'hono';
import type { AskResult } from '@digitalchokro/core';
import { addAskChokroRoutes } from '../index.js';

describe('Adapter: Hono', () => {
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
    const app = new Hono();
    addAskChokroRoutes(app, mockAgent);

    const res = await app.request('/api/ask', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ question: 'Hello' })
    });

    expect(res.status).toBe(200);
    const json = await res.json() as AskResult;
    expect(json.answer).toBe('Test answer');
    expect(json.sql).toBe('SELECT 1');
    expect(mockAgent.ask).toHaveBeenCalledWith('Hello', {});
  });

  it('rejects /api/ask without question', async () => {
    const app = new Hono();
    addAskChokroRoutes(app, mockAgent);

    const res = await app.request('/api/ask', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({})
    });

    expect(res.status).toBe(400);
    const json = await res.json() as { error: any };
    expect(json.error.code).toBe('BAD_REQUEST');
  });

  it('handles /api/ask/stream successfully', async () => {
    const app = new Hono();
    addAskChokroRoutes(app, mockAgent);

    const res = await app.request('/api/ask/stream', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ question: 'Hello' })
    });

    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toContain('text/event-stream');
    
    const text = await res.text();
    expect(text).toContain('data: {"content":"Test "}');
    expect(text).toContain('data: {"content":"stream"}');
    expect(text).toContain('data: {"done":true');
  });

  it('handles streaming errors gracefully', async () => {
    mockAgent.stream = vi.fn().mockImplementation(async function* () {
      throw new Error('Stream failed');
    });

    const app = new Hono();
    addAskChokroRoutes(app, mockAgent);

    const res = await app.request('/api/ask/stream', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ question: 'Hello' })
    });

    expect(res.status).toBe(200);
    const text = await res.text();
    expect(text).toContain('data: {"error":"Stream failed"}');
  });
});
