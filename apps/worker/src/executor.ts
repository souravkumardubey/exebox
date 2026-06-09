import { Job } from 'bullmq';
import { getDatabase } from '@exebox/database';
import { executeInSandbox } from '@exebox/sandbox';
import { createLogger } from '@exebox/logger';
import type { QueueJobData, TestResult } from '@exebox/shared';

const logger = createLogger('Executor');

const COMMENT_STYLES: Record<string, { line: string }> = {
  python: { line: '#' },
  javascript: { line: '//' },
  typescript: { line: '//' },
  cpp: { line: '//' },
  java: { line: '//' },
  go: { line: '//' },
  rust: { line: '//' },
};

const COMPILED_LANGS = new Set(['cpp', 'java', 'go', 'rust']);

function hasMain(code: string, language: string): boolean {
  if (language === 'cpp') return /\bint\s+main\s*\(/.test(code);
  if (language === 'java') return /public\s+static\s+void\s+main\s*\(/.test(code);
  if (language === 'go') return /\bfunc\s+main\s*\(/.test(code);
  if (language === 'rust') return /\bfn\s+main\s*\(/.test(code);
  return true;
}

function extractFuncName(code: string, language: string): string | null {
  if (language === 'go') {
    const m = code.match(/func\s+(\w+)\s*\(/);
    return m ? m[1] : null;
  }
  if (language === 'rust') {
    const m = code.match(/fn\s+(\w+)\s*\(/);
    return m ? m[1] : null;
  }
  const m = code.match(
    /(?:\b(?:\w+(?:<[^>]*>)?(?:\s*[&*])?)\s+)(\w+)\s*\([^)]*\)\s*(?:\bconst\b)?\s*(?:{|:\s*$)/,
  );
  if (m) {
    const name = m[1];
    if (!/^(?:if|while|for|return|switch|catch|int|char|bool|void|long|double|float|unsigned|signed|auto|public|private|protected|class|struct|virtual|override)$/.test(name)) {
      return name;
    }
  }
  return null;
}

function buildWrapper(language: string, funcName: string): string {
  if (language === 'cpp') {
    return `
#ifndef CODEX_MAIN_WRAPPER
#define CODEX_MAIN_WRAPPER
int main() {
    std::string __in;
    std::getline(std::cin, __in);
    std::cout << ${funcName}(__in) << std::endl;
    return 0;
}
#endif
`;
  }
  return `\nint main() { return 0; }\n`;
}

function buildTestCode(language: string, sourceCode: string): string {
  const style = COMMENT_STYLES[language] || COMMENT_STYLES['python'];
  const annotated = `${sourceCode}\n\n${style.line} exebox test wrapper — read input from stdin`;

  if (!COMPILED_LANGS.has(language)) return annotated;
  if (hasMain(sourceCode, language)) return annotated;

  const funcName = extractFuncName(sourceCode, language);
  if (!funcName) return annotated;

  const wrapper = buildWrapper(language, funcName);
  return `${sourceCode}\n\n${wrapper}`;
}

export async function processExecutionJob(job: Job<QueueJobData>) {
  const { executionId, language, sourceCode, stdin, testCases, sessionId } = job.data;

  logger.info({ executionId, language }, 'Processing execution job');

  const db = getDatabase();

  try {
    await db.execution.update({
      where: { id: executionId },
      data: { status: 'RUNNING' },
    });

    await job.updateProgress(10);

    let stdout = '';
    let stderr = '';
    let runtime = 0;
    let memoryUsed = 0;
    let exitCode = 0;
    let testResults: TestResult[] | undefined;

    if (testCases && testCases.length > 0) {
      testResults = [];
      let totalRuntime = 0;
      let totalMemory = 0;
      let allCompileError = true;

      for (let i = 0; i < testCases.length; i++) {
        const tc = testCases[i];
        const code = buildTestCode(language, sourceCode);
        const result = await executeInSandbox(language, code, tc.input);

        const actual = result.stdout.trim();
        const expected = tc.expectedOutput.trim();
        const passed = actual === expected;

        if (result.exitCode === 0 || result.stderr.trim()) {
          allCompileError = false;
        }

        testResults.push({
          input: tc.input,
          expectedOutput: expected,
          actualOutput: actual,
          passed,
          runtime: result.runtime,
        });

        totalRuntime += result.runtime;
        totalMemory += result.memoryUsed;
        if (i > 0) {
          if (stdout && !stdout.endsWith('\n')) stdout += '\n';
          if (stderr && !stderr.endsWith('\n')) stderr += '\n';
        }
        stdout += result.stdout;
        stderr += result.stderr;

        await job.updateProgress(Math.round(((i + 1) / testCases.length) * 80) + 10);
      }

      runtime = totalRuntime;
      memoryUsed = testCases.length > 0 ? Math.round(totalMemory / testCases.length) : 0;

      const passedTests = testResults.filter((t) => t.passed).length;
      const totalTests = testResults.length;
      const allPassed = passedTests === totalTests;
      const isCompileError = allCompileError && !!stderr.trim();

      const executionError = isCompileError ? 'COMPILATION_ERROR' : null;

      await db.execution.update({
        where: { id: executionId },
        data: {
          status: 'COMPLETED',
          stdout,
          stderr,
          runtimeMs: runtime,
          memoryKb: memoryUsed,
          exitCode,
          error: executionError,
          testResults: testResults as any,
        },
      });
    } else {
      const result = await executeInSandbox(language, sourceCode, stdin);

      stdout = result.stdout;
      stderr = result.stderr;
      runtime = result.runtime;
      memoryUsed = result.memoryUsed;
      exitCode = result.exitCode;

      logger.info({ executionId, runtime, memoryUsed, exitCode }, 'Execution completed');

      await job.updateProgress(90);

      if (result.error === 'TIMEOUT') {
        await db.execution.update({
          where: { id: executionId },
          data: {
            status: 'TIMEOUT',
            stdout,
            stderr,
            runtimeMs: runtime,
            memoryKb: memoryUsed,
            exitCode: -1,
            error: 'Execution timed out',
          },
        });
        return;
      }

      await db.execution.update({
        where: { id: executionId },
        data: {
          status: 'COMPLETED',
          stdout,
          stderr,
          runtimeMs: runtime,
          memoryKb: memoryUsed,
          exitCode,
          error: null,
        },
      });
    }

    await job.updateProgress(100);
    logger.info({ executionId, status: 'completed' }, 'Execution job completed');
  } catch (error: any) {
    logger.error({ executionId, error: error.message }, 'Execution job failed');

    await db.execution.update({
      where: { id: executionId },
      data: {
        status: 'FAILED',
        stderr: error.message,
        error: error.message,
      },
    });

    throw error;
  }
}
