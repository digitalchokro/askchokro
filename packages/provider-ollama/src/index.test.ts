import { describe, it, expect } from 'vitest';
import { OllamaProvider } from './index';

describe('OllamaProvider', () => {
  it('throws an error if no model is provided', () => {
    // @ts-expect-error Testing invalid config
    expect(() => new OllamaProvider()).toThrow();
  });

  it('instantiates correctly with model', () => {
    const provider = new OllamaProvider({ model: 'qwen2.5-coder' });
    expect(provider).toBeInstanceOf(OllamaProvider);
    expect(provider.name).toBe('ollama');
  });
});
