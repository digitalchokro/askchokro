import type { Context, MiddlewareHandler } from 'hono';
import type { AskResult, TenantContext } from '@digitalchokro/core';
import { streamSSE } from 'hono/streaming';

export interface AskChokroHonoOptions {
  /** 
   * Function to extract tenant context from the Hono Context.
   * If tenant scoping is enabled in the agent, this context will be used.
   */
  getContext?: (c: Context) => TenantContext | Promise<TenantContext>;
  
  /** Trust X-Forwarded-For headers when extracting client IP. Default: false. */
  trustProxy?: boolean;

  /** Handle errors before they are sent to the client. */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  onError?: (err: any, c: Context) => void | Promise<void>;
}

export function createAskChokroMiddleware(
  agent: { 
    ask(question: string, context?: TenantContext): Promise<AskResult>,
    stream?(question: string, context?: TenantContext): AsyncIterable<{ content?: string; chart?: any; done?: boolean; metadata?: any }>
  },
  options?: AskChokroHonoOptions
): MiddlewareHandler {
  return async (c, next) => {
    
    // We only intercept specific paths for this middleware, or we can assume it's mounted on a specific route.
    // Usually middleware intercepts everything, but for an API endpoint we should check the path.
    // Better yet, in Hono we just return a new Hono router with the routes attached.
    // Let's implement this as an app router instead of middleware, similar to Fastify.
    
    await next();
  };
}

// Since Hono uses a router, it's often better to export a function that registers routes on an existing app,
// or returns a sub-app. We will export `askChokroRoutes` which takes a Hono instance.

export function addAskChokroRoutes(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  app: any, 
  agent: { 
    ask(question: string, context?: TenantContext): Promise<AskResult>,
    stream?(question: string, context?: TenantContext): AsyncIterable<{ content?: string; chart?: any; done?: boolean; metadata?: any }>
  },
  options?: AskChokroHonoOptions
) {
  app.post('/api/ask', async (c: Context) => {
    try {
      const body = await c.req.json().catch(() => ({}));
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
      const question = body?.question;
      
      if (!question || typeof question !== 'string') {
        c.status(400);
        return c.json({
          error: {
            code: 'BAD_REQUEST',
            message: 'A "question" string field is required in the JSON body.'
          }
        });
      }

      const context = options?.getContext ? await options.getContext(c) : {};
      const result = await agent.ask(question, context);
      
      return c.json(result);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (err: any) {
      if (options?.onError) {
        await options.onError(err, c);
        if (c.res) return c.res;
      }
      
      const status = err.code === 'VALIDATION_ERROR' ? 400 : 500;
      c.status(status);
      return c.json({
        error: {
          code: err.code || 'INTERNAL_ERROR',
          message: err.message || 'An unexpected error occurred.',
          suggestion: err.suggestion
        }
      });
    }
  });

  app.post('/api/ask/stream', async (c: Context) => {
    if (!agent.stream) {
      c.status(501);
      return c.json({ error: 'Streaming not supported by this agent configuration.' });
    }

    try {
      const body = await c.req.json().catch(() => ({}));
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
      const question = body?.question;
      
      if (!question || typeof question !== 'string') {
        c.status(400);
        return c.json({
          error: {
            code: 'BAD_REQUEST',
            message: 'A "question" string field is required in the JSON body.'
          }
        });
      }

      const context = options?.getContext ? await options.getContext(c) : {};
      
      return streamSSE(c, async (stream) => {
        try {
          for await (const chunk of agent.stream!(question, context)) {
            await stream.writeSSE({ data: JSON.stringify(chunk) });
          }
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        } catch (err: any) {
          await stream.writeSSE({ data: JSON.stringify({ error: err.message }) });
        }
      });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (err: any) {
      if (options?.onError) {
        await options.onError(err, c);
        if (c.res) return c.res;
      }
      
      const status = err.code === 'VALIDATION_ERROR' ? 400 : 500;
      c.status(status);
      return c.json({
        error: {
          code: err.code || 'INTERNAL_ERROR',
          message: err.message || 'An unexpected error occurred.',
          suggestion: err.suggestion
        }
      });
    }
  });
}
