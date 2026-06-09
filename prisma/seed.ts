import { PrismaClient } from '@prisma/client';
import { createHash, randomBytes } from 'crypto';
import Redis from 'ioredis';

const prisma = new PrismaClient();
const redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');

function generateApiKey(name: string): { key: string; prefix: string; hash: string } {
  const prefix = name.toLowerCase().replace(/[^a-z0-9]/g, '_').slice(0, 12);
  const random = randomBytes(24).toString('base64url');
  const key = `exe_sk_${prefix}_${random}`;
  const hash = createHash('sha256').update(key).digest('hex');
  return { key, prefix, hash };
}

async function main() {
  console.log('Seeding database...');

  const admin = generateApiKey('admin');

  await prisma.apiKey.upsert({
    where: { keyHash: admin.hash },
    update: { name: 'Admin Key' },
    create: {
      name: 'Admin Key',
      keyPrefix: admin.prefix,
      keyHash: admin.hash,
    },
  });

  await redis.sadd('exebox:api_keys', admin.hash);

  console.log(`\n  Admin API Key: ${admin.key}`);
  console.log('  Save this key — it will not be shown again.\n');

  const dev = generateApiKey('development');

  await prisma.apiKey.upsert({
    where: { keyHash: dev.hash },
    update: { name: 'Development Key' },
    create: {
      name: 'Development Key',
      keyPrefix: dev.prefix,
      keyHash: dev.hash,
    },
  });

  await redis.sadd('exebox:api_keys', dev.hash);

  console.log(`  Dev API Key: ${dev.key}`);
  console.log('  Save this key — it will not be shown again.\n');

  console.log('Seeding complete.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await redis.quit();
    await prisma.$disconnect();
  });
