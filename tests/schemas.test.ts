import { describe, it, expect } from 'vitest';
import {
  createExecutionSchema,
  batchExecutionSchema,
  createSessionSchema,
  sessionExecSchema,
  paginationSchema,
  testCaseSchema,
} from '../apps/api-server/src/dto/schemas';

describe('createExecutionSchema', () => {
  it('accepts valid python execution', () => {
    const result = createExecutionSchema.safeParse({
      language: 'python',
      sourceCode: 'print("hello")',
    });
    expect(result.success).toBe(true);
  });

  it('accepts all languages', () => {
    for (const lang of ['python', 'javascript', 'typescript', 'go', 'java', 'cpp', 'rust']) {
      const result = createExecutionSchema.safeParse({ language: lang, sourceCode: 'x' });
      expect(result.success).toBe(true);
    }
  });

  it('rejects unsupported language', () => {
    const result = createExecutionSchema.safeParse({
      language: 'ruby',
      sourceCode: 'puts "hi"',
    });
    expect(result.success).toBe(false);
  });

  it('rejects empty sourceCode', () => {
    const result = createExecutionSchema.safeParse({
      language: 'python',
      sourceCode: '',
    });
    expect(result.success).toBe(false);
  });

  it('rejects sourceCode over 50000 chars', () => {
    const result = createExecutionSchema.safeParse({
      language: 'python',
      sourceCode: 'x'.repeat(50001),
    });
    expect(result.success).toBe(false);
  });

  it('accepts with stdin', () => {
    const result = createExecutionSchema.safeParse({
      language: 'python',
      sourceCode: 'print(input())',
      stdin: 'hello',
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.stdin).toBe('hello');
    }
  });

  it('defaults stdin to empty string', () => {
    const result = createExecutionSchema.safeParse({
      language: 'python',
      sourceCode: 'print(1)',
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.stdin).toBe('');
    }
  });

  it('accepts custom timeout within range', () => {
    const result = createExecutionSchema.safeParse({
      language: 'python',
      sourceCode: 'print(1)',
      timeout: 5000,
    });
    expect(result.success).toBe(true);
  });

  it('rejects timeout below 1000ms', () => {
    const result = createExecutionSchema.safeParse({
      language: 'python',
      sourceCode: 'print(1)',
      timeout: 500,
    });
    expect(result.success).toBe(false);
  });

  it('rejects timeout above 60000ms', () => {
    const result = createExecutionSchema.safeParse({
      language: 'python',
      sourceCode: 'print(1)',
      timeout: 61000,
    });
    expect(result.success).toBe(false);
  });
});

describe('batchExecutionSchema', () => {
  it('accepts valid batch with test cases', () => {
    const result = batchExecutionSchema.safeParse({
      language: 'javascript',
      sourceCode: 'console.log(args[0])',
      testCases: [
        { input: '5', expectedOutput: '5' },
        { expectedOutput: 'hello' },
      ],
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.testCases).toHaveLength(2);
      expect(result.data.testCases[0].input).toBe('5');
      expect(result.data.testCases[1].input).toBe('');
    }
  });

  it('rejects batch with zero test cases', () => {
    const result = batchExecutionSchema.safeParse({
      language: 'go',
      sourceCode: 'package main',
      testCases: [],
    });
    expect(result.success).toBe(false);
  });

  it('rejects batch with over 100 test cases', () => {
    const result = batchExecutionSchema.safeParse({
      language: 'go',
      sourceCode: 'package main',
      testCases: Array(101).fill({ expectedOutput: 'x' }),
    });
    expect(result.success).toBe(false);
  });
});

describe('createSessionSchema', () => {
  it('accepts valid session request', () => {
    const result = createSessionSchema.safeParse({ language: 'python' });
    expect(result.success).toBe(true);
  });

  it('rejects missing language', () => {
    const result = createSessionSchema.safeParse({});
    expect(result.success).toBe(false);
  });
});

describe('sessionExecSchema', () => {
  it('accepts valid session execution', () => {
    const result = sessionExecSchema.safeParse({
      code: 'print(1)',
      stdin: 'hello',
    });
    expect(result.success).toBe(true);
  });

  it('defaults stdin to empty', () => {
    const result = sessionExecSchema.safeParse({ code: 'print(1)' });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.stdin).toBe('');
    }
  });

  it('rejects empty code', () => {
    const result = sessionExecSchema.safeParse({ code: '' });
    expect(result.success).toBe(false);
  });
});

describe('paginationSchema', () => {
  it('defaults to page 1, limit 20', () => {
    const result = paginationSchema.safeParse({});
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.page).toBe(1);
      expect(result.data.limit).toBe(20);
    }
  });

  it('accepts custom pagination', () => {
    const result = paginationSchema.safeParse({ page: '3', limit: '50' });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.page).toBe(3);
      expect(result.data.limit).toBe(50);
    }
  });

  it('rejects limit over 100', () => {
    const result = paginationSchema.safeParse({ limit: '200' });
    expect(result.success).toBe(false);
  });
});

describe('testCaseSchema', () => {
  it('defaults hidden to false', () => {
    const result = testCaseSchema.safeParse({ expectedOutput: 'foo' });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.hidden).toBe(false);
    }
  });

  it('defaults input to empty string', () => {
    const result = testCaseSchema.safeParse({ expectedOutput: 'foo' });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.input).toBe('');
    }
  });
});
