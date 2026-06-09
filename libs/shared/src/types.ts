export interface ExecutionRequest {
  language: string;
  sourceCode: string;
  stdin?: string;
  timeout?: number;
  testCases?: TestCase[];
}

export interface TestCase {
  input: string;
  expectedOutput: string;
  hidden?: boolean;
}

export interface TestResult {
  input: string;
  expectedOutput: string;
  actualOutput: string;
  passed: boolean;
  runtime: number;
}

export interface ExecutionResult {
  executionId: string;
  stdout: string;
  stderr: string;
  runtime: number;
  memoryUsed: number;
  exitCode: number;
  status: string;
  error?: string;
  testResults?: TestResult[];
}

export interface SandboxConfig {
  memoryLimit: string;
  cpuLimit: number;
  timeout: number;
  disableNetwork: boolean;
  readOnlyFS: boolean;
  removeAfter: boolean;
}

export interface LanguageConfig {
  image: string;
  compileCommand?: string;
  runCommand: string;
  extension: string;
  memoryLimit: string;
  cpuLimit: number;
  timeout: number;
}

export interface QueueJobData {
  executionId: string;
  language: string;
  sourceCode: string;
  stdin: string;
  testCases?: Array<{
    input: string;
    expectedOutput: string;
    hidden?: boolean;
  }>;
  apiKeyId?: string;
  sessionId?: string;
  timestamp: number;
}

export interface PaginatedResult<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
  timestamp: string;
}

export interface CreateSessionRequest {
  language: string;
}

export interface SessionResponse {
  sessionId: string;
  language: string;
  status: string;
  expiresAt: string;
}

export interface CreateExecutionResponse {
  executionId: string;
  status: string;
}
