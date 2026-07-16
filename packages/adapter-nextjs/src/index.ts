import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import type { AskResult, TenantContext } from '@digitalchokro/core';

export interface AskChokroNextOptions {
  /** 
   * Function to extract tenant context from the Request.
   * If tenant scoping is enabled in the agent, this context will be used.
   */
  getContext?: (req: NextRequest) => TenantContext | Promise<TenantContext>;
  
  /** Trust X-Forwarded-For headers when extracting client IP. Default: false. */
  trustProxy?: boolean;

  /** Handle errors before they are sent to the client. */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  onError?: (err: any, req: NextRequest) => NextResponse | Promise<NextResponse>;
}

export function createAskChokroRoute(
  agent: { ask(question: string, context?: TenantContext): Promise<AskResult> },
  options?: AskChokroNextOptions
) {
  return async (req: NextRequest): Promise<NextResponse> => {
    try {
      const body = await req.json().catch(() => ({})) as Record<string, unknown>;
      const question = body.question;
      
      if (!question || typeof question !== 'string') {
        return NextResponse.json({
          error: {
            code: 'BAD_REQUEST',
            message: 'A "question" string field is required in the JSON body.'
          }
        }, { status: 400 });
      }

      const context = options?.getContext ? await options.getContext(req) : {};
      const result = await agent.ask(question, context);
      
      return NextResponse.json(result, { status: 200 });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (err: any) {
      if (options?.onError) {
        return await options.onError(err, req);
      } else {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        const CLIENT_ERROR_CODES = new Set([
          'SQL_VALIDATION_FAILED',
          'TENANT_ID_MISSING',
          'RATE_LIMIT_EXCEEDED',
          'IP_WHITELIST_BLOCKED',
          'CANNOT_ANSWER',
        ]);
        const status = CLIENT_ERROR_CODES.has(err.code) ? 400 : 500;
        return NextResponse.json({
          error: {
            // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
            code: err.code || 'INTERNAL_ERROR',
            // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
            message: err.message || 'An unexpected error occurred.',
            // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
            suggestion: err.suggestion
          }
        }, { status });
      }
    }
  };
}

export function createAskChokroStreamRoute(
  agent: { 
    ask(question: string, context?: TenantContext): Promise<AskResult>,
    stream?(question: string, context?: TenantContext): AsyncIterable<{ content?: string; chart?: any; done?: boolean; metadata?: any }>
  },
  options?: AskChokroNextOptions
) {
  return async (req: NextRequest): Promise<NextResponse | Response> => {
    if (!agent.stream) {
      return NextResponse.json({ error: 'Streaming not supported by this agent configuration.' }, { status: 501 });
    }

    try {
      const body = await req.json().catch(() => ({})) as Record<string, unknown>;
      const question = body.question;
      
      if (!question || typeof question !== 'string') {
        return NextResponse.json({
          error: {
            code: 'BAD_REQUEST',
            message: 'A "question" string field is required in the JSON body.'
          }
        }, { status: 400 });
      }

      const context = options?.getContext ? await options.getContext(req) : {};
      
      const stream = new ReadableStream({
        async start(controller) {
          try {
            for await (const chunk of agent.stream!(question, context)) {
              controller.enqueue(new TextEncoder().encode(`data: ${JSON.stringify(chunk)}\n\n`));
            }
            controller.close();
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          } catch (err: any) {
            controller.enqueue(new TextEncoder().encode(`data: ${JSON.stringify({ error: err.message })}\n\n`));
            controller.close();
          }
        }
      });

      return new Response(stream, {
        headers: {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          'Connection': 'keep-alive',
        },
      });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (err: any) {
      if (options?.onError) {
        return await options.onError(err, req);
      } else {
          const CLIENT_ERROR_CODES = new Set([
            'SQL_VALIDATION_FAILED',
            'TENANT_ID_MISSING',
            'RATE_LIMIT_EXCEEDED',
            'IP_WHITELIST_BLOCKED',
            'CANNOT_ANSWER',
          ]);
          const status = CLIENT_ERROR_CODES.has(err.code) ? 400 : 500;
          return NextResponse.json({
            error: {
              // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
              code: err.code || 'INTERNAL_ERROR',
              // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
              message: err.message || 'An unexpected error occurred.',
              // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
              suggestion: err.suggestion
            }
          }, { status });
        }
    }
  };
}
