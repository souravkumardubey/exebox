import { z } from 'zod';
import { SUPPORTED_LANGUAGES } from '@exebox/shared';

export const testCaseSchema = z.object({
  input: z.string().optional().default(''),
  expectedOutput: z.string(),
  hidden: z.boolean().optional().default(false),
});

export const createExecutionSchema = z.object({
  language: z.enum(SUPPORTED_LANGUAGES as unknown as [string, ...string[]]),
  sourceCode: z.string().min(1).max(50000),
  stdin: z.string().optional().default(''),
  timeout: z.number().int().min(1000).max(60000).optional(),
});

export const batchExecutionSchema = createExecutionSchema.extend({
  testCases: z.array(testCaseSchema).min(1).max(100),
});

export const createSessionSchema = z.object({
  language: z.enum(SUPPORTED_LANGUAGES as unknown as [string, ...string[]]),
});

export const sessionExecSchema = z.object({
  code: z.string().min(1).max(50000),
  stdin: z.string().optional().default(''),
});

export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).optional().default(1),
  limit: z.coerce.number().int().min(1).max(100).optional().default(20),
});
