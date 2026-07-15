import type { Request, Response, RequestHandler } from 'express';
import type { AskResult, TenantContext } from '@digitalchokro/core';

export interface AskChokroExpressOptions {
  /** 
   * Function to extract tenant context from the Request.
   * If tenant scoping is enabled in the agent, this context will be used.
   */
  getContext?: (req: Request) => TenantContext | Promise<TenantContext>;
  
  /** Trust X-Forwarded-For headers when extracting client IP. Default: false. */
  trustProxy?: boolean;

  /** Handle errors before they are sent to the client. */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  onError?: (err: any, req: Request, res: Response) => void;
}

export function createAskChokroMiddleware(
  agent: { ask(question: string, context?: TenantContext): Promise<AskResult> },
  options?: AskChokroExpressOptions
): RequestHandler {
  return async (req: Request, res: Response): Promise<void> => {
    try {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
      const question = req.body?.question;
      
      if (!question || typeof question !== 'string') {
        res.status(400).json({
          error: {
            code: 'BAD_REQUEST',
            message: 'A "question" string field is required in the JSON body.'
          }
        });
        return;
      }

      const context = options?.getContext ? await options.getContext(req) : {};
      const result = await agent.ask(question, context);
      
      res.status(200).json(result);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (err: any) {
      if (options?.onError) {
        options.onError(err, req, res);
      } else {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        const status = err.code === 'VALIDATION_ERROR' ? 400 : 500;
        res.status(status).json({
          error: {
            // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
            code: err.code || 'INTERNAL_ERROR',
            // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
            message: err.message || 'An unexpected error occurred.',
            // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
            suggestion: err.suggestion
          }
        });
      }
    }
  };
}

export function createAskChokroStreamMiddleware(
  agent: { 
    ask(question: string, context?: TenantContext): Promise<AskResult>,
    stream?(question: string, context?: TenantContext): AsyncIterable<{ content?: string; chart?: any; done?: boolean; metadata?: any }>
  },
  options?: AskChokroExpressOptions
): RequestHandler {
  return async (req: Request, res: Response): Promise<void> => {
    if (!agent.stream) {
      res.status(501).json({ error: 'Streaming not supported by this agent configuration.' });
      return;
    }

    try {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
      const question = req.body?.question;
      
      if (!question || typeof question !== 'string') {
        res.status(400).json({
          error: {
            code: 'BAD_REQUEST',
            message: 'A "question" string field is required in the JSON body.'
          }
        });
        return;
      }

      const context = options?.getContext ? await options.getContext(req) : {};
      
      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');
      res.flushHeaders();

      for await (const chunk of agent.stream(question, context)) {
        res.write(`data: ${JSON.stringify(chunk)}\n\n`);
      }
      
      res.end();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (err: any) {
      if (!res.headersSent) {
        if (options?.onError) {
          options.onError(err, req, res);
        } else {
          // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
          const status = err.code === 'VALIDATION_ERROR' ? 400 : 500;
          res.status(status).json({
            error: {
              // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
              code: err.code || 'INTERNAL_ERROR',
              // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
              message: err.message || 'An unexpected error occurred.',
              // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
              suggestion: err.suggestion
            }
          });
        }
      } else {
        res.write(`data: ${JSON.stringify({ error: err.message })}\n\n`);
        res.end();
      }
    }
  };
}
