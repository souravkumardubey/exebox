import { describe, it, expect } from 'vitest';
import { SUPPORTED_LANGUAGES, LANGUAGE_CONFIG, QUEUE_NAMES, EXECUTION_EVENTS, API_KEY_PREFIX } from '../libs/shared/src';

describe('SUPPORTED_LANGUAGES', () => {
  it('has 7 languages', () => {
    expect(SUPPORTED_LANGUAGES).toHaveLength(7);
  });

  it('includes python', () => {
    expect(SUPPORTED_LANGUAGES).toContain('python');
  });

  it('includes rust', () => {
    expect(SUPPORTED_LANGUAGES).toContain('rust');
  });
});

describe('LANGUAGE_CONFIG', () => {
  it('every language has required fields', () => {
    for (const lang of SUPPORTED_LANGUAGES) {
      const config = LANGUAGE_CONFIG[lang];
      expect(config).toBeDefined();
      expect(config.image).toBeTruthy();
      expect(config.runCommand).toBeTruthy();
      expect(config.extension).toMatch(/^\./);
      expect(config.memoryLimit).toMatch(/^\d+m$/);
      expect(config.cpuLimit).toBeGreaterThan(0);
      expect(config.timeout).toBeGreaterThan(0);
    }
  });

  it('python uses exebox-python image', () => {
    expect(LANGUAGE_CONFIG.python.image).toBe('exebox-python:latest');
  });

  it('javascript and typescript share exebox-node', () => {
    expect(LANGUAGE_CONFIG.javascript.image).toBe('exebox-node:latest');
    expect(LANGUAGE_CONFIG.typescript.image).toBe('exebox-node:latest');
  });

  it('typescript has compileCommand', () => {
    expect(LANGUAGE_CONFIG.typescript.compileCommand).toBeTruthy();
  });

  it('java has highest memory limit', () => {
    const javaMem = parseInt(LANGUAGE_CONFIG.java.memoryLimit);
    const pyMem = parseInt(LANGUAGE_CONFIG.python.memoryLimit);
    expect(javaMem).toBeGreaterThanOrEqual(pyMem);
  });
});

describe('QUEUE_NAMES', () => {
  it('has execution queue name', () => {
    expect(QUEUE_NAMES.EXECUTION).toBe('exebox-execution');
  });

  it('has DLQ name', () => {
    expect(QUEUE_NAMES.EXECUTION_DLQ).toBe('exebox-execution-dlq');
  });
});

describe('EXECUTION_EVENTS', () => {
  it('all events are prefixed with execution:', () => {
    for (const [key, value] of Object.entries(EXECUTION_EVENTS)) {
      expect(value).toMatch(/^execution:/);
    }
  });
});

describe('API_KEY_PREFIX', () => {
  it('is exe_sk', () => {
    expect(API_KEY_PREFIX).toBe('exe_sk');
  });
});
