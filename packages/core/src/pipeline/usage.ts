/**
 * @digitalchokro/core — Token usage accounting
 *
 * `AskResult.tokenUsage` used to be hard-coded to zero: the agent declared the
 * counters and never wrote to them, so every caller building cost dashboards
 * on top of it read a flat line. The counts live in the provider SDK
 * responses, but each SDK names them differently, so providers collect them
 * here and the agent drains the total once per question.
 *
 * The drain-on-read shape matters: one question can involve several model
 * calls (generation, retries after a validation failure, then formatting), and
 * all of them must land in the same total.
 */

import type { TokenUsage } from '../interfaces/ai-provider.js';

export class UsageAccumulator {
  private input = 0;
  private output = 0;

  /**
   * Add one response's counts. Undefined or non-finite values contribute
   * nothing, so a provider that reports only prompt tokens still gets a
   * truthful partial total instead of a NaN.
   */
  add(input: number | undefined | null, output: number | undefined | null): void {
    if (typeof input === 'number' && Number.isFinite(input)) this.input += input;
    if (typeof output === 'number' && Number.isFinite(output)) this.output += output;
  }

  /** Return the accumulated counts and reset to zero. */
  drain(): TokenUsage {
    const usage = { input: this.input, output: this.output };
    this.input = 0;
    this.output = 0;
    return usage;
  }
}
