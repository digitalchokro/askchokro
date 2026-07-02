import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import type { DatabaseAgent } from '@digitalchokro/core';
import type { TenantContext } from '@digitalchokro/core';

export interface AskChokroNextOptions {
  /** 
   * Function to extract tenant context from the Request.
   * If tenant scoping is enabled in the agent, this context will be used.
   */
  getContext?: (req: NextRequest) => TenantContext | Promise<TenantContext>;
  
  /** Handle errors before they are sent to the client. */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  onError?: (err: any, req: NextRequest) => NextResponse | Promise<NextResponse>;
}

export function createAskChokroRoute(
  agent: DatabaseAgent,
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
        const status = err.code === 'VALIDATION_ERROR' ? 400 : 500;
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
