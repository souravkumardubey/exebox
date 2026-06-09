export const SUPPORTED_LANGUAGES = [
  'python',
  'javascript',
  'typescript',
  'go',
  'java',
  'cpp',
  'rust',
] as const;

export type SupportedLanguage = (typeof SUPPORTED_LANGUAGES)[number];

export const LANGUAGE_CONFIG: Record<
  SupportedLanguage,
  {
    image: string;
    compileCommand?: string;
    runCommand: string;
    extension: string;
    memoryLimit: string;
    cpuLimit: number;
    timeout: number;
  }
> = {
  python: {
    image: 'exebox-python:latest',
    runCommand: 'python3 /code/main.py',
    extension: '.py',
    memoryLimit: '256m',
    cpuLimit: 0.5,
    timeout: 10000,
  },
  javascript: {
    image: 'exebox-node:latest',
    runCommand: 'node /code/main.js',
    extension: '.js',
    memoryLimit: '256m',
    cpuLimit: 0.5,
    timeout: 10000,
  },
  typescript: {
    image: 'exebox-node:latest',
    compileCommand: 'npx ts-node --transpile-only /code/main.ts',
    runCommand: 'node /code/main.js',
    extension: '.ts',
    memoryLimit: '256m',
    cpuLimit: 0.5,
    timeout: 15000,
  },
  go: {
    image: 'exebox-go:latest',
    compileCommand: 'go build -o /code/main /code/main.go',
    runCommand: '/code/main',
    extension: '.go',
    memoryLimit: '256m',
    cpuLimit: 0.5,
    timeout: 15000,
  },
  java: {
    image: 'exebox-java:latest',
    compileCommand: 'javac /code/Main.java -d /code',
    runCommand: 'java -cp /code Main',
    extension: '.java',
    memoryLimit: '512m',
    cpuLimit: 1,
    timeout: 20000,
  },
  cpp: {
    image: 'exebox-cpp:latest',
    compileCommand: 'g++ -o /code/main /code/main.cpp -std=c++17 -O2',
    runCommand: '/code/main',
    extension: '.cpp',
    memoryLimit: '256m',
    cpuLimit: 0.5,
    timeout: 15000,
  },
  rust: {
    image: 'exebox-rust:latest',
    compileCommand: 'rustc -o /code/main /code/main.rs',
    runCommand: '/code/main',
    extension: '.rs',
    memoryLimit: '512m',
    cpuLimit: 1,
    timeout: 20000,
  },
};

export const QUEUE_NAMES = {
  EXECUTION: 'exebox-execution',
  EXECUTION_DLQ: 'exebox-execution-dlq',
} as const;

export const EXECUTION_EVENTS = {
  QUEUED: 'execution:queued',
  STARTED: 'execution:started',
  LOG: 'execution:log',
  COMPLETED: 'execution:completed',
  FAILED: 'execution:failed',
  TIMEOUT: 'execution:timeout',
  PROGRESS: 'execution:progress',
} as const;

export const PAGINATION_DEFAULTS = {
  PAGE: 1,
  LIMIT: 20,
  MAX_LIMIT: 100,
} as const;

export const RATE_LIMIT = {
  TTL: 60,
  MAX_REQUESTS: 100,
} as const;

export const API_KEY_PREFIX = 'exe_sk';
