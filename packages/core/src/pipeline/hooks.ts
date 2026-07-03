/**
 * @digitalchokro/core — Lifecycle Hooks System
 *
 * Allows developers to intercept and modify every stage of the pipeline
 * without forking the core. All hooks are optional.
 */

import type { TenantContext } from '../types/context.js';
import type { FullSchema } from '../types/schema.js';
import type { AskResult } from '../types/result.js';

export interface PipelineHooks {
  beforeSchemaRead?: (ctx: TenantContext) => Promise<void>;
  afterSchemaRead?: (ctx: TenantContext, schema: FullSchema) => Promise<void>;

  beforePrompt?: (ctx: TenantContext, question: string) => Promise<string | void>;
  afterPrompt?: (ctx: TenantContext, prompt: string) => Promise<void>;

  beforeVectorSearch?: (ctx: TenantContext, question: string) => Promise<void>;
  afterVectorSearch?: (ctx: TenantContext, results: import('../interfaces/vector-database.js').VectorSearchResult[]) => Promise<void>;

  beforeGenerateSQL?: (ctx: TenantContext, prompt: string) => Promise<void>;
  afterGenerateSQL?: (ctx: TenantContext, sql: string) => Promise<string | void>;

  beforeExecute?: (ctx: TenantContext, sql: string) => Promise<void>;
  afterExecute?: (ctx: TenantContext, sql: string, rows: Record<string, unknown>[]) => Promise<void>;

  beforeResponse?: (ctx: TenantContext, rows: Record<string, unknown>[]) => Promise<Record<string, unknown>[] | void>;
  afterResponse?: (ctx: TenantContext, result: AskResult) => Promise<void>;

  onError?: (ctx: TenantContext, error: Error) => Promise<void>;
}

export class HooksEmitter {
  private hooks: PipelineHooks;

  constructor(hooks: PipelineHooks = {}) {
    this.hooks = hooks;
  }

  async emit<K extends keyof PipelineHooks>(
    hookName: K,
    ...args: Parameters<NonNullable<PipelineHooks[K]>>
  ): Promise<ReturnType<NonNullable<PipelineHooks[K]>> | void> {
    const hook = this.hooks[hookName];
    if (hook) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return (hook as (...a: any[]) => any)(...args);
    }
    return undefined;
  }
}
