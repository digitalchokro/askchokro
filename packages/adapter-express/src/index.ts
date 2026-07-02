import type { Request, Response, RequestHandler } from 'express';
import type { DatabaseAgent } from '@askchokro/core';
import type { TenantContext } from '@askchokro/core';

export interface AskChokroExpressOptions {
  /** 
   * Function to extract tenant context from the Request.
   * If tenant scoping is enabled in the agent, this context will be used.
   */
  getContext?: (req: Request) => TenantContext | Promise<TenantContext>;
  
  /** Handle errors before they are sent to the client. */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  onError?: (err: any, req: Request, res: Response) => void;
}

export function createAskChokroMiddleware(
  agent: DatabaseAgent,
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
