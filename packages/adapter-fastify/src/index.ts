import type { FastifyPluginAsync, FastifyRequest, FastifyReply } from 'fastify';
import type { AskResult, TenantContext } from '@digitalchokro/core';

export interface AskChokroFastifyOptions {
  /** 
   * Function to extract tenant context from the FastifyRequest.
   * If tenant scoping is enabled in the agent, this context will be used.
   */
  getContext?: (req: FastifyRequest) => TenantContext | Promise<TenantContext>;
  
  /** Trust X-Forwarded-For headers when extracting client IP. Default: false. */
  trustProxy?: boolean;

  /** Handle errors before they are sent to the client. */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  onError?: (err: any, req: FastifyRequest, reply: FastifyReply) => void | Promise<void>;
}

export function createAskChokroPlugin(
  agent: { 
    ask(question: string, context?: TenantContext): Promise<AskResult>,
    stream?(question: string, context?: TenantContext): AsyncIterable<{ content?: string; chart?: any; done?: boolean; metadata?: any }>
  },
  options?: AskChokroFastifyOptions
): FastifyPluginAsync {
  return async (fastify) => {
    
    fastify.post('/api/ask', async (req, reply) => {
      try {
        const body = req.body as { question?: string };
        const question = body?.question;
        
        if (!question || typeof question !== 'string') {
          reply.status(400).send({
            error: {
              code: 'BAD_REQUEST',
              message: 'A "question" string field is required in the JSON body.'
            }
          });
          return;
        }

        const context = options?.getContext ? await options.getContext(req) : {};
        const result = await agent.ask(question, context);
        
        reply.status(200).send(result);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } catch (err: any) {
        if (options?.onError) {
          await options.onError(err, req, reply);
        } else {
          const CLIENT_ERROR_CODES = new Set([
            'SQL_VALIDATION_FAILED',
            'TENANT_ID_MISSING',
            'RATE_LIMIT_EXCEEDED',
            'IP_WHITELIST_BLOCKED',
            'CANNOT_ANSWER',
          ]);
          const status = CLIENT_ERROR_CODES.has(err.code) ? 400 : 500;
          reply.status(status).send({
            error: {
              code: err.code || 'INTERNAL_ERROR',
              message: err.message || 'An unexpected error occurred.',
              suggestion: err.suggestion
            }
          });
        }
      }
    });

    fastify.post('/api/ask/stream', async (req, reply) => {
      if (!agent.stream) {
        reply.status(501).send({ error: 'Streaming not supported by this agent configuration.' });
        return;
      }

      try {
        const body = req.body as { question?: string };
        const question = body?.question;
        
        if (!question || typeof question !== 'string') {
          reply.status(400).send({
            error: {
              code: 'BAD_REQUEST',
              message: 'A "question" string field is required in the JSON body.'
            }
          });
          return;
        }

        const context = options?.getContext ? await options.getContext(req) : {};
        
        reply.raw.setHeader('Content-Type', 'text/event-stream');
        reply.raw.setHeader('Cache-Control', 'no-cache');
        reply.raw.setHeader('Connection', 'keep-alive');

        for await (const chunk of agent.stream(question, context)) {
          reply.raw.write(`data: ${JSON.stringify(chunk)}\n\n`);
        }
        
        reply.raw.end();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } catch (err: any) {
        if (!reply.raw.headersSent) {
          if (options?.onError) {
            await options.onError(err, req, reply);
          } else {
            const CLIENT_ERROR_CODES = new Set([
              'SQL_VALIDATION_FAILED',
              'TENANT_ID_MISSING',
              'RATE_LIMIT_EXCEEDED',
              'IP_WHITELIST_BLOCKED',
              'CANNOT_ANSWER',
            ]);
            const status = CLIENT_ERROR_CODES.has(err.code) ? 400 : 500;
            reply.raw.removeHeader('Content-Type');
            reply.status(status).send({
              error: {
                code: err.code || 'INTERNAL_ERROR',
                message: err.message || 'An unexpected error occurred.',
                suggestion: err.suggestion
              }
            });
          }
        } else {
          reply.raw.write(`data: ${JSON.stringify({ error: err.message })}\n\n`);
          reply.raw.end();
        }
      }
    });

  };
}
