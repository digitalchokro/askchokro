import { afterEach, describe, expect, it, vi } from 'vitest';
import { HELP_TEXT, main } from './index.js';

afterEach(() => {
  vi.restoreAllMocks();
});

describe('CLI package', () => {
  it('exposes the help text with the documented commands', () => {
    expect(HELP_TEXT).toContain('demo');
    expect(HELP_TEXT).toContain('--help');
    expect(HELP_TEXT).toContain('--version');
  });

  it('prints help and exits cleanly for --help', () => {
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const exitSpy = vi.spyOn(process, 'exit').mockImplementation((() => undefined) as never);

    main(['--help']);

    expect(logSpy).toHaveBeenCalledWith(HELP_TEXT);
    expect(errorSpy).not.toHaveBeenCalled();
    expect(exitSpy).toHaveBeenCalledWith(0);
  });
});
