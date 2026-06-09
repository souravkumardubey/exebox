import Docker from 'dockerode';
import { createLogger } from '@exebox/logger';
import { LANGUAGE_CONFIG } from '@exebox/shared';
import type { SupportedLanguage, SandboxConfig } from '@exebox/shared';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import { Writable } from 'stream';

const logger = createLogger('Sandbox');

const docker = new Docker({
  socketPath: process.env.DOCKER_SOCKET || '/var/run/docker.sock',
});

const DEFAULT_SANDBOX_CONFIG: SandboxConfig = {
  memoryLimit: '256m',
  cpuLimit: 0.5,
  timeout: 10000,
  disableNetwork: true,
  readOnlyFS: true,
  removeAfter: true,
};

export interface SandboxResult {
  stdout: string;
  stderr: string;
  exitCode: number;
  runtime: number;
  memoryUsed: number;
  error?: string;
}

export async function executeInSandbox(
  language: string,
  sourceCode: string,
  stdin: string = '',
  config?: Partial<SandboxConfig>,
): Promise<SandboxResult> {
  const langConfig = LANGUAGE_CONFIG[language as SupportedLanguage];
  if (!langConfig) {
    throw new Error(`Unsupported language: ${language}`);
  }

  const sandboxConfig = { ...DEFAULT_SANDBOX_CONFIG, ...config };
  const timeout = sandboxConfig.timeout || langConfig.timeout;

  const workspaceId = `exebox-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;
  const workspacePath = path.join(os.tmpdir(), workspaceId);

  try {
    await fs.mkdir(workspacePath, { recursive: true });

    const sourceFile = path.join(workspacePath, `main${langConfig.extension}`);
    await fs.writeFile(sourceFile, sourceCode);

    if (stdin) {
      await fs.writeFile(path.join(workspacePath, 'stdin.txt'), stdin);
    }

    try {
      const image = docker.getImage(langConfig.image);
      await image.inspect();
    } catch {
      logger.warn({ image: langConfig.image }, 'Image not found locally, pulling...');
      await pullImage(langConfig.image);
    }

    const startTime = Date.now();

    const stdinRedirect = stdin ? ' < /code/stdin.txt' : '';
    const runCmd = langConfig.compileCommand
      ? `${langConfig.compileCommand} && ${langConfig.runCommand}${stdinRedirect}`
      : `${langConfig.runCommand}${stdinRedirect}`;

    const container = await docker.createContainer({
      Image: langConfig.image,
      Cmd: ['/bin/sh', '-c', runCmd],
      WorkingDir: '/code',
      HostConfig: {
        Binds: [`${workspacePath}:/code:rw`],
        Memory: parseMemoryLimit(sandboxConfig.memoryLimit),
        NanoCpus: Math.floor(sandboxConfig.cpuLimit * 1e9),
        NetworkMode: sandboxConfig.disableNetwork ? 'none' : 'bridge',
        ReadonlyRootfs: sandboxConfig.readOnlyFS,
        SecurityOpt: ['no-new-privileges:true'],
        CapDrop: ['ALL'],
        PidsLimit: 500,
        Ulimits: [
          { Name: 'nofile', Soft: 1024, Hard: 2048 },
        ],
        Tmpfs: {
          '/tmp': 'size=100m,noexec,nosuid,nodev',
        },
      },
      AttachStdout: true,
      AttachStderr: true,
      Env: [
        'NODE_ENV=sandbox',
        'HOME=/tmp',
      ],
    });

    await container.start();

    const stream = await container.attach({
      stream: true,
      stdout: true,
      stderr: true,
    });

    let stdout = '';
    let stderr = '';

    const stdoutChunks: Buffer[] = [];
    const stderrChunks: Buffer[] = [];

    const stdoutWritable = new Writable({
      write(chunk: Buffer, _encoding, callback) {
        stdoutChunks.push(chunk);
        callback();
      },
    });

    const stderrWritable = new Writable({
      write(chunk: Buffer, _encoding, callback) {
        stderrChunks.push(chunk);
        callback();
      },
    });

    container.modem.demuxStream(stream, stdoutWritable, stderrWritable);

    const streamPromise = new Promise<void>((resolve, reject) => {
      stream.on('end', () => {
        stdout = Buffer.concat(stdoutChunks).toString('utf8');
        stderr = Buffer.concat(stderrChunks).toString('utf8');
        resolve();
      });
      stream.on('error', reject);
    });

    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(
        () => reject(new Error('Execution timeout')),
        timeout + 5000,
      );
    });

    await Promise.race([streamPromise, timeoutPromise]);
    const waitResult = await container.wait();

    const runtime = Date.now() - startTime;

    let memoryUsed = 0;
    try {
      const stats = await container.stats({ stream: false });
      memoryUsed = stats.memory_stats?.usage || 0;
    } catch {
      // Stats may not be available
    }

    await container.remove({ force: true });

    return {
      stdout,
      stderr,
      exitCode: waitResult.StatusCode,
      runtime,
      memoryUsed: Math.round(memoryUsed / 1024),
      error: undefined,
    };
  } catch (error: any) {
    const runtime = 0;
    if (error.message === 'Execution timeout') {
      return {
        stdout: '',
        stderr: 'Execution timed out',
        exitCode: -1,
        runtime,
        memoryUsed: 0,
        error: 'TIMEOUT',
      };
    }
    return {
      stdout: '',
      stderr: error.message || 'Unknown error',
      exitCode: -1,
      runtime,
      memoryUsed: 0,
      error: error.message,
    };
  } finally {
    try {
      await fs.rm(workspacePath, { recursive: true, force: true });
    } catch {
      // ignore cleanup errors
    }
  }
}

function parseMemoryLimit(limit: string): number {
  const match = limit.match(/^(\d+)(m|g|k)?$/);
  if (!match) return 256 * 1024 * 1024;

  const value = parseInt(match[1]);
  const unit = match[2];

  switch (unit) {
    case 'k':
      return value * 1024;
    case 'm':
      return value * 1024 * 1024;
    case 'g':
      return value * 1024 * 1024 * 1024;
    default:
      return value;
  }
}

async function pullImage(imageName: string): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    docker.pull(imageName, (err: Error | null, stream: any) => {
      if (err) {
        reject(err);
        return;
      }
      docker.modem.followProgress(stream, (err: Error | null) => {
        if (err) reject(err);
        else resolve();
      });
    });
  });
}

export async function checkDockerAvailability(): Promise<boolean> {
  try {
    await docker.ping();
    return true;
  } catch {
    return false;
  }
}

export { docker };
