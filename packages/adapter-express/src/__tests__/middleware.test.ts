/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-return, @typescript-eslint/unbound-method, @typescript-eslint/explicit-function-return-type, @typescript-eslint/no-unnecessary-type-assertion */
import { describe, it, expect, beforeEach, vi, type Mock } from 'vitest';
import type { Request, Response } from 'express';
import { createAskChokroMiddleware } from '../index.js';
import { AskChokroError } from '@digitalchokro/core';

describe('@digitalchokro/adapter-express', () => {
  let mockAgent: { ask: Mock };
  let mockReq: Partial<Request>;
  let mockRes: Partial<Response>;
  let mockStatus: Mock;
  let mockJson: Mock;

  beforeEach(() => {
    mockAgent = { ask: vi.fn() };
    
    mockStatus = vi.fn().mockReturnThis();
    mockJson = vi.fn();
    
    mockReq = {
      body: {},
    };
    
    mockRes = {
      status: mockStatus,
      json: mockJson,
    };
  });

  describe('Middleware Validation', () => {
    it('returns 400 if question is missing from body', async () => {
      const middleware = createAskChokroMiddleware(mockAgent);
      await middleware(mockReq as Request, mockRes as Response, vi.fn());
      
      expect(mockStatus).toHaveBeenCalledWith(400);
      expect(mockJson).toHaveBeenCalledWith({
        error: {
          code: 'BAD_REQUEST',
          message: 'A "question" string field is required in the JSON body.'
        }
      });
      expect(mockAgent.ask).not.toHaveBeenCalled();
    });

    it('returns 400 if question is not a string', async () => {
      mockReq.body = { question: 123 };
      const middleware = createAskChokroMiddleware(mockAgent);
      await middleware(mockReq as Request, mockRes as Response, vi.fn());
      
      expect(mockStatus).toHaveBeenCalledWith(400);
      expect(mockJson).toHaveBeenCalledWith(expect.objectContaining({
        error: expect.objectContaining({ code: 'BAD_REQUEST' })
      }));
    });
  });

  describe('Successful Processing', () => {
    it('calls agent.ask and returns 200 with result', async () => {
      mockReq.body = { question: 'What is the total revenue?' };
      const expectedResult = { answer: 'Total revenue is $1000' };
      mockAgent.ask.mockResolvedValue(expectedResult);
      
      const middleware = createAskChokroMiddleware(mockAgent);
      await middleware(mockReq as Request, mockRes as Response, vi.fn());
      
      expect(mockAgent.ask).toHaveBeenCalledWith('What is the total revenue?', {});
      expect(mockStatus).toHaveBeenCalledWith(200);
      expect(mockJson).toHaveBeenCalledWith(expectedResult);
    });

    it('uses context from getContext option', async () => {
      mockReq.body = { question: 'My revenue?' };
      const getContext = vi.fn().mockReturnValue({ tenant_id: 'tenant-1' });
      
      const middleware = createAskChokroMiddleware(mockAgent, { getContext });
      await middleware(mockReq as Request, mockRes as Response, vi.fn());
      
      expect(getContext).toHaveBeenCalledWith(mockReq);
      expect(mockAgent.ask).toHaveBeenCalledWith('My revenue?', { tenant_id: 'tenant-1' });
    });
  });

  describe('Error Handling', () => {
    it('returns 400 for SQL_VALIDATION_FAILED', async () => {
      mockReq.body = { question: 'Bad question' };
      const err = new AskChokroError('SQL_VALIDATION_FAILED', 'Invalid SQL', 'Check your SQL syntax');
      mockAgent.ask.mockRejectedValue(err);
      
      const middleware = createAskChokroMiddleware(mockAgent);
      await middleware(mockReq as Request, mockRes as Response, vi.fn());
      
      expect(mockStatus).toHaveBeenCalledWith(400);
      expect(mockJson).toHaveBeenCalledWith({
        error: {
          code: 'SQL_VALIDATION_FAILED',
          message: 'Invalid SQL',
          suggestion: 'Check your SQL syntax'
        }
      });
    });

    it('returns 500 for generic errors', async () => {
      mockReq.body = { question: 'Query' };
      const err = new Error('Database down');
      mockAgent.ask.mockRejectedValue(err);
      
      const middleware = createAskChokroMiddleware(mockAgent);
      await middleware(mockReq as Request, mockRes as Response, vi.fn());
      
      expect(mockStatus).toHaveBeenCalledWith(500);
      expect(mockJson).toHaveBeenCalledWith({
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Database down',
          suggestion: undefined
        }
      });
    });

    it('uses custom onError handler if provided', async () => {
      mockReq.body = { question: 'Query' };
      const err = new Error('Database down');
      mockAgent.ask.mockRejectedValue(err);
      
      const onError = vi.fn();
      const middleware = createAskChokroMiddleware(mockAgent, { onError });
      await middleware(mockReq as Request, mockRes as Response, vi.fn());
      
      expect(onError).toHaveBeenCalledWith(err, mockReq, mockRes);
      expect(mockStatus).not.toHaveBeenCalled(); // Let custom handler deal with it
    });
  });
});
