#!/usr/bin/env tsx
import { PrismaClient } from '@prisma/client';
import { createHash, randomBytes } from 'crypto';
import Redis from 'ioredis';

const prisma = new PrismaClient();
const redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');

const name = process.argv[2] || 'cli-generated';

async function main() {
  const prefix = name.toLowerCase().replace(/[^a-z0-9]/g, '_').slice(0, 12);
  const random = randomBytes(24).toString('base64url');
  const key = `exe_sk_${prefix}_${random}`;
  const keyHash = createHash('sha256').update(key).digest('hex');

  await prisma.apiKey.create({
    data: { name, keyPrefix: prefix, keyHash },
  });

  await redis.sadd('exebox:api_keys', keyHash);

  console.log(`Created API key "${name}":`);
  console.log(key);
  console.log('\nSave this key — it will not be shown again.');

  await redis.quit();
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
