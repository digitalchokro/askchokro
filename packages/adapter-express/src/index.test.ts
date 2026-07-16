import { describe, it, expect, vi } from 'vitest';
import express from 'express';
import request from 'supertest';
import { createAskChokroMiddleware } from './index.js';
import type { DatabaseAgent } from '@digitalchokro/core';

describe('Express Adapter', () => {
  it('handles a valid request and returns the result', async () => {
    const mockAgent = {
      ask: vi.fn().mockResolvedValue({ answer: '42', sql: 'SELECT 42', rows: [{ '42': 42 }] })
    } as unknown as DatabaseAgent;

    const app = express();
    app.use(express.json());
    app.post('/api/ask', createAskChokroMiddleware(mockAgent));

    const response = await request(app)
      .post('/api/ask')
      .send({ question: 'What is the answer?' });

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ answer: '42', sql: 'SELECT 42', rows: [{ '42': 42 }] });
    // eslint-disable-next-line @typescript-eslint/unbound-method
    expect(mockAgent.ask).toHaveBeenCalledWith('What is the answer?', { ip: '::ffff:127.0.0.1' });
  });

  it('rejects requests without a question', async () => {
    const mockAgent = {
      ask: vi.fn()
    } as unknown as DatabaseAgent;

    const app = express();
    app.use(express.json());
    app.post('/api/ask', createAskChokroMiddleware(mockAgent));

    const response = await request(app)
      .post('/api/ask')
      .send({});

    expect(response.status).toBe(400);
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    expect(response.body.error.code).toBe('BAD_REQUEST');
  });

  it('applies tenant context if getContext is provided', async () => {
    const mockAgent = {
      ask: vi.fn().mockResolvedValue({ answer: '1' })
    } as unknown as DatabaseAgent;

    const app = express();
    app.use(express.json());
    app.post('/api/ask', createAskChokroMiddleware(mockAgent, {
      getContext: (req) => ({ tenantId: req.headers['x-tenant-id'] as string })
    }));

    await request(app)
      .post('/api/ask')
      .set('x-tenant-id', 'tenant-123')
      .send({ question: 'Hi' });

    // eslint-disable-next-line @typescript-eslint/unbound-method
    expect(mockAgent.ask).toHaveBeenCalledWith('Hi', { tenantId: 'tenant-123', ip: '::ffff:127.0.0.1' });
  });
});
