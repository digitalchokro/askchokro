import { describe, it, expect } from 'vitest';
import { isChartConfig } from '../index.js';

describe('isChartConfig', () => {
  it('accepts a well-formed chart', () => {
    expect(isChartConfig({ type: 'bar', xAxisKey: 'month', yAxisKeys: ['revenue'] })).toBe(true);
  });

  it('rejects a chart missing axis keys (the shape LLMs often hallucinate)', () => {
    expect(isChartConfig({ type: 'bar' })).toBe(false);
  });

  it('rejects a bad type, non-string yAxisKeys, and non-objects', () => {
    expect(isChartConfig({ type: 'scatter', xAxisKey: 'x', yAxisKeys: ['y'] })).toBe(false);
    expect(isChartConfig({ type: 'bar', xAxisKey: 'x', yAxisKeys: [1, 2] })).toBe(false);
    expect(isChartConfig(null)).toBe(false);
    expect(isChartConfig('bar')).toBe(false);
  });
});
