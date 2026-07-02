import { describe, it, expect, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { createAskChokroRoute } from './index.js';
import type { DatabaseAgent } from '@askchokro/core';

describe('Next.js App Router Adapter', () => {
  it('handles a valid request and returns the result', async () => {
    const mockAgent = {
      ask: vi.fn().mockResolvedValue({ answer: '42', sql: 'SELECT 42', rows: [{ '42': 42 }] })
    } as unknown as DatabaseAgent;

    const handler = createAskChokroRoute(mockAgent);
    const req = new NextRequest('http://localhost/api/ask', {
      method: 'POST',
      body: JSON.stringify({ question: 'What is the answer?' })
    });

    const res = await handler(req);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body).toEqual({ answer: '42', sql: 'SELECT 42', rows: [{ '42': 42 }] });
    expect(mockAgent.ask).toHaveBeenCalledWith('What is the answer?', {});
  });

  it('rejects requests without a question', async () => {
    const mockAgent = {
      ask: vi.fn()
    } as unknown as DatabaseAgent;

    const handler = createAskChokroRoute(mockAgent);
    const req = new NextRequest('http://localhost/api/ask', {
      method: 'POST',
      body: JSON.stringify({})
    });

    const res = await handler(req);
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error.code).toBe('BAD_REQUEST');
  });

  it('applies tenant context if getContext is provided', async () => {
    const mockAgent = {
      ask: vi.fn().mockResolvedValue({ answer: '1' })
    } as unknown as DatabaseAgent;

    const handler = createAskChokroRoute(mockAgent, {
      getContext: (req) => ({ tenantId: req.headers.get('x-tenant-id') as string })
    });

    const req = new NextRequest('http://localhost/api/ask', {
      method: 'POST',
      body: JSON.stringify({ question: 'Hi' }),
      headers: {
        'x-tenant-id': 'tenant-123'
      }
    });

    await handler(req);
    expect(mockAgent.ask).toHaveBeenCalledWith('Hi', { tenantId: 'tenant-123' });
  });
});
