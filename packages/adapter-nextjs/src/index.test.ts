import { describe, it, expect, beforeEach, vi, type Mock } from 'vitest';
import { createAskChokroRoute } from './index.js';
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { AskChokroError } from '@digitalchokro/core';

// Mock Next.js NextResponse
vi.mock('next/server', () => {
  return {
    NextResponse: {
      json: vi.fn((body, init) => ({ body, init }))
    }
  };
});

describe('@digitalchokro/adapter-nextjs', () => {
  let mockAgent: { ask: Mock };
  let mockReq: Partial<NextRequest>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockAgent = { ask: vi.fn() };
    
    mockReq = {
      json: vi.fn().mockResolvedValue({}),
    };
  });

  describe('Route Validation', () => {
    it('returns 400 if question is missing from body', async () => {
      const route = createAskChokroRoute(mockAgent);
      await route(mockReq as NextRequest);
      
      expect(NextResponse.json).toHaveBeenCalledWith(
        {
          error: {
            code: 'BAD_REQUEST',
            message: 'A "question" string field is required in the JSON body.'
          }
        },
        { status: 400 }
      );
      expect(mockAgent.ask).not.toHaveBeenCalled();
    });

    it('returns 400 if JSON parsing fails', async () => {
      mockReq.json = vi.fn().mockRejectedValue(new Error('Invalid JSON'));
      const route = createAskChokroRoute(mockAgent);
      await route(mockReq as NextRequest);
      
      expect(NextResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({ error: expect.objectContaining({ code: 'BAD_REQUEST' }) }),
        { status: 400 }
      );
    });
  });

  describe('Successful Processing', () => {
    it('calls agent.ask and returns 200 with result', async () => {
      mockReq.json = vi.fn().mockResolvedValue({ question: 'What is the total revenue?' });
      const expectedResult = { answer: 'Total revenue is $1000' };
      mockAgent.ask.mockResolvedValue(expectedResult);
      
      const route = createAskChokroRoute(mockAgent);
      const result = await route(mockReq as NextRequest);
      
      expect(mockAgent.ask).toHaveBeenCalledWith('What is the total revenue?', {});
      expect(NextResponse.json).toHaveBeenCalledWith(expectedResult, { status: 200 });
      expect(result).toEqual({ body: expectedResult, init: { status: 200 } });
    });

    it('uses context from getContext option', async () => {
      mockReq.json = vi.fn().mockResolvedValue({ question: 'My revenue?' });
      const getContext = vi.fn().mockReturnValue({ tenant_id: 'tenant-1' });
      
      const route = createAskChokroRoute(mockAgent, { getContext });
      await route(mockReq as NextRequest);
      
      expect(getContext).toHaveBeenCalledWith(mockReq);
      expect(mockAgent.ask).toHaveBeenCalledWith('My revenue?', { tenant_id: 'tenant-1' });
    });
  });

  describe('Error Handling', () => {
    it('returns 400 for SQL_VALIDATION_FAILED', async () => {
      mockReq.json = vi.fn().mockResolvedValue({ question: 'Bad question' });
      const err = new AskChokroError('SQL_VALIDATION_FAILED', 'Invalid SQL');
      mockAgent.ask.mockRejectedValue(err);
      
      const route = createAskChokroRoute(mockAgent);
      await route(mockReq as NextRequest);
      
      expect(NextResponse.json).toHaveBeenCalledWith(
        {
          error: {
            code: 'SQL_VALIDATION_FAILED',
            message: 'Invalid SQL',
            suggestion: undefined
          }
        },
        { status: 400 }
      );
    });

    it('returns 500 for generic errors', async () => {
      mockReq.json = vi.fn().mockResolvedValue({ question: 'Query' });
      const err = new Error('Database down');
      mockAgent.ask.mockRejectedValue(err);
      
      const route = createAskChokroRoute(mockAgent);
      await route(mockReq as NextRequest);
      
      expect(NextResponse.json).toHaveBeenCalledWith(
        {
          error: {
            code: 'INTERNAL_ERROR',
            message: 'Database down',
            suggestion: undefined
          }
        },
        { status: 500 }
      );
    });

    it('uses custom onError handler if provided', async () => {
      mockReq.json = vi.fn().mockResolvedValue({ question: 'Query' });
      const err = new Error('Database down');
      mockAgent.ask.mockRejectedValue(err);
      
      const mockCustomResponse = { body: 'Custom error', init: { status: 503 } } as unknown as NextResponse;
      const onError = vi.fn().mockResolvedValue(mockCustomResponse);
      
      const route = createAskChokroRoute(mockAgent, { onError });
      const res = await route(mockReq as NextRequest);
      
      expect(onError).toHaveBeenCalledWith(err, mockReq);
      expect(res).toBe(mockCustomResponse);
      expect(NextResponse.json).not.toHaveBeenCalled(); // Let custom handler deal with it
    });
  });
});
