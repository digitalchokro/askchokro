import { describe, it, expect, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { createAskChokroRoute } from './index.js';
import type { DatabaseAgent } from '@digitalchokro/core';

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

    const response = await handler(req);

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ answer: '42', sql: 'SELECT 42', rows: [{ '42': 42 }] });
    // eslint-disable-next-line @typescript-eslint/unbound-method
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

    const response = await handler(req);

    expect(response.status).toBe(400);
    const body = await response.json() as { error: { code: string } };
    expect(body.error.code).toBe('BAD_REQUEST');
  });

  it('applies tenant context if getContext is provided', async () => {
    const mockAgent = {
      ask: vi.fn().mockResolvedValue({ answer: '1' })
    } as unknown as DatabaseAgent;

    const route = createAskChokroRoute(mockAgent, {
      getContext: (req) => ({ tenantId: req.headers.get('x-tenant-id') as string })
    });

    const req = new NextRequest('http://localhost/api/ask', {
      method: 'POST',
      body: JSON.stringify({ question: 'Hi' }),
      headers: {
        'x-tenant-id': 'tenant-123'
      }
    });

    await route(req);
    // eslint-disable-next-line @typescript-eslint/unbound-method
    expect(mockAgent.ask).toHaveBeenCalledWith('Hi', { tenantId: 'tenant-123' });
  });
});
