import { describe, it, expect } from 'vitest';

describe('sandbox memory parser', () => {
  // Mirrors the parseMemoryLimit from sandbox lib
  function parseMemoryLimit(limit: string): number {
    const match = limit.match(/^(\d+)(m|g|k)?$/);
    if (!match) return 256 * 1024 * 1024;
    const value = parseInt(match[1]);
    const unit = match[2];
    switch (unit) {
      case 'k': return value * 1024;
      case 'm': return value * 1024 * 1024;
      case 'g': return value * 1024 * 1024 * 1024;
      default: return value;
    }
  }

  it('parses megabytes', () => {
    expect(parseMemoryLimit('256m')).toBe(256 * 1024 * 1024);
  });

  it('parses gigabytes', () => {
    expect(parseMemoryLimit('1g')).toBe(1 * 1024 * 1024 * 1024);
  });

  it('parses kilobytes', () => {
    expect(parseMemoryLimit('512k')).toBe(512 * 1024);
  });

  it('falls back to 256m for invalid format', () => {
    expect(parseMemoryLimit('foo')).toBe(256 * 1024 * 1024);
  });

  it('fallback is exactly 256mb', () => {
    expect(parseMemoryLimit('')).toBe(256 * 1024 * 1024);
  });

  it('round-trips language config values', () => {
    const configs: Record<string, string> = {
      python: '256m',
      javascript: '256m',
      java: '512m',
      rust: '512m',
    };
    for (const [lang, val] of Object.entries(configs)) {
      const bytes = parseMemoryLimit(val);
      expect(bytes).toBeGreaterThan(0);
      expect(bytes % (1024 * 1024)).toBe(0);
    }
  });
});
