import { describe, it, expect, vi, afterEach } from 'vitest';
import { UsageAccumulator } from '../../pipeline/usage.js';

describe('UsageAccumulator', () => {
  it('starts at zero', () => {
    expect(new UsageAccumulator().drain()).toEqual({ input: 0, output: 0 });
  });

  it('sums across calls, so retries and formatting land in one total', () => {
    const usage = new UsageAccumulator();
    usage.add(10, 5);
    usage.add(3, 2);
    expect(usage.drain()).toEqual({ input: 13, output: 7 });
  });

  // Ollama omits prompt_eval_count on a cached prompt; Groq and OpenAI omit
  // usage entirely on some streamed responses.
  it('ignores undefined and null counts', () => {
    const usage = new UsageAccumulator();
    usage.add(undefined, 5);
    usage.add(null, null);
    usage.add(7, undefined);
    expect(usage.drain()).toEqual({ input: 7, output: 5 });
  });

  it('ignores non-finite counts', () => {
    const usage = new UsageAccumulator();
    usage.add(NaN, Infinity);
    usage.add(4, 4);
    expect(usage.drain()).toEqual({ input: 4, output: 4 });
  });

  // The agent calls consumeUsage() once per pipeline stage, so a peek that
  // left the counters in place would double-count every request.
  it('resets on drain', () => {
    const usage = new UsageAccumulator();
    usage.add(10, 5);
    expect(usage.drain()).toEqual({ input: 10, output: 5 });
    expect(usage.drain()).toEqual({ input: 0, output: 0 });
  });

  it('keeps accumulating after a drain', () => {
    const usage = new UsageAccumulator();
    usage.add(10, 5);
    usage.drain();
    usage.add(1, 2);
    expect(usage.drain()).toEqual({ input: 1, output: 2 });
  });

  it('hands back a fresh object each time', () => {
    const usage = new UsageAccumulator();
    const first = usage.drain();
    usage.add(9, 9);
    expect(first).toEqual({ input: 0, output: 0 });
  });
});

describe('InMemoryCacheProvider.increment', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('starts a missing counter at 1 and counts up', async () => {
    const { InMemoryCacheProvider } = await import('../../providers/memory-cache.js');
    const cache = new InMemoryCacheProvider();

    expect(await cache.increment('rl:1', 60)).toBe(1);
    expect(await cache.increment('rl:1', 60)).toBe(2);
    expect(await cache.increment('rl:1', 60)).toBe(3);
  });

  it('keeps separate keys independent', async () => {
    const { InMemoryCacheProvider } = await import('../../providers/memory-cache.js');
    const cache = new InMemoryCacheProvider();

    await cache.increment('rl:a', 60);
    await cache.increment('rl:a', 60);
    expect(await cache.increment('rl:b', 60)).toBe(1);
  });

  it('exposes the counter through get()', async () => {
    const { InMemoryCacheProvider } = await import('../../providers/memory-cache.js');
    const cache = new InMemoryCacheProvider();

    await cache.increment('rl:1', 60);
    await cache.increment('rl:1', 60);
    expect(await cache.get<number>('rl:1')).toBe(2);
  });

  // The TTL is set when the window opens and is not extended by later hits —
  // a fixed window, not a sliding one.
  it('restarts the count once the window expires', async () => {
    vi.useFakeTimers();
    const { InMemoryCacheProvider } = await import('../../providers/memory-cache.js');
    const cache = new InMemoryCacheProvider();

    expect(await cache.increment('rl:1', 60)).toBe(1);
    vi.advanceTimersByTime(30_000);
    expect(await cache.increment('rl:1', 60)).toBe(2);

    // 61s after the window opened, so the original entry has expired.
    vi.advanceTimersByTime(31_000);
    expect(await cache.increment('rl:1', 60)).toBe(1);
  });

  it('treats a non-numeric existing value as zero rather than producing NaN', async () => {
    const { InMemoryCacheProvider } = await import('../../providers/memory-cache.js');
    const cache = new InMemoryCacheProvider();

    await cache.set('rl:1', 'not-a-number', 60);
    expect(await cache.increment('rl:1', 60)).toBe(1);
  });
});
