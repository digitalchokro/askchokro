import { describe, it, expect } from 'vitest';
import { AnthropicProvider } from './index';

describe('AnthropicProvider', () => {
  it('instantiates correctly when API key is provided', () => {
    const provider = new AnthropicProvider({ apiKey: 'test-key' });
    expect(provider).toBeInstanceOf(AnthropicProvider);
    expect(provider.name).toBe('anthropic');
  });
});
