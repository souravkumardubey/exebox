import { getDatabase } from '@exebox/database';
import { docker } from '@exebox/sandbox';
import { createLogger } from '@exebox/logger';
import { LANGUAGE_CONFIG } from '@exebox/shared';
import type { SupportedLanguage } from '@exebox/shared';

const logger = createLogger('SessionManager');

export async function createSessionContainer(
  sessionId: string,
  language: string,
): Promise<string> {
  const langConfig = LANGUAGE_CONFIG[language as SupportedLanguage];
  if (!langConfig) {
    throw new Error(`Unsupported language for session: ${language}`);
  }

  try {
    const image = docker.getImage(langConfig.image);
    await image.inspect();
  } catch {
    logger.warn({ image: langConfig.image }, 'Pulling image for session');
    await pullImage(langConfig.image);
  }

  const container = await docker.createContainer({
    Image: langConfig.image,
    Cmd: ['/bin/sh', '-c', 'sleep 1800'], // 30 min idle timeout
    WorkingDir: '/code',
    HostConfig: {
      Memory: parseMemoryLimit(langConfig.memoryLimit),
      NanoCpus: Math.floor(langConfig.cpuLimit * 1e9),
      NetworkMode: 'none',
      ReadonlyRootfs: true,
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
    Env: [
      'NODE_ENV=sandbox',
      'HOME=/tmp',
    ],
  });

  await container.start();

  const containerId = container.id;

  const db = getDatabase();
  await db.session.update({
    where: { id: sessionId },
    data: { containerId },
  });

  logger.info({ sessionId, containerId }, 'Session container created');
  return containerId;
}

export async function destroySessionContainer(sessionId: string): Promise<void> {
  const db = getDatabase();
  const session = await db.session.findUnique({
    where: { id: sessionId },
  });

  if (!session || !session.containerId) {
    logger.warn({ sessionId }, 'No container to destroy for session');
    return;
  }

  try {
    const container = docker.getContainer(session.containerId);
    await container.stop({ t: 5 }).catch(() => {});
    await container.remove({ force: true });
    logger.info({ sessionId, containerId: session.containerId }, 'Session container destroyed');
  } catch (error: any) {
    logger.error({ sessionId, error: error.message }, 'Failed to destroy session container');
  }

  await db.session.update({
    where: { id: sessionId },
    data: {
      status: 'DESTROYED',
      containerId: null,
    },
  });
}

export async function executeInSession(
  containerId: string,
  language: string,
  sourceCode: string,
  stdin: string = '',
): Promise<{ stdout: string; stderr: string; exitCode: number }> {
  const langConfig = LANGUAGE_CONFIG[language as SupportedLanguage];
  if (!langConfig) {
    throw new Error(`Unsupported language: ${language}`);
  }

  const container = docker.getContainer(containerId);

  const exec = await container.exec({
    Cmd: ['/bin/sh', '-c', `${langConfig.runCommand} ${stdin ? '< /dev/stdin' : ''}`],
    AttachStdout: true,
    AttachStderr: true,
    AttachStdin: stdin ? true : false,
  });

  const stream = await exec.start({
    Tty: false,
    stdin: stdin ? true : false,
  });

  let stdout = '';
  let stderr = '';

  if (stdin) {
    stream.write(stdin);
    stream.end();
  }

  for await (const chunk of stream) {
    const str = chunk.toString();
    stdout += str;
  }

  const inspect = await exec.inspect();
  return { stdout, stderr, exitCode: inspect.ExitCode ?? -1 };
}

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

async function pullImage(imageName: string): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    docker.pull(imageName, (err: Error | null, stream: any) => {
      if (err) { reject(err); return; }
      docker.modem.followProgress(stream, (err: Error | null) => {
        if (err) reject(err);
        else resolve();
      });
    });
  });
}
