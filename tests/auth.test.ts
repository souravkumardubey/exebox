import { describe, it, expect } from 'vitest';
import { createHash } from 'crypto';

function hashKey(key: string): string {
  if (!key.startsWith('exe_sk_')) return 'invalid';
  return createHash('sha256').update(key).digest('hex');
}

describe('auth logic', () => {
  it('hashes a valid API key correctly', () => {
    const key = 'exe_sk_admin_test123hash';
    const hash = hashKey(key);
    expect(hash).toHaveLength(64); // sha256 hex
    expect(hash).toMatch(/^[a-f0-9]{64}$/);
  });

  it('rejects key without exe_sk_ prefix', () => {
    expect(hashKey('sk_admin_test')).toBe('invalid');
  });

  it('produces consistent hashes', () => {
    const key = 'exe_sk_admin_test456hash';
    expect(hashKey(key)).toBe(hashKey(key));
  });

  it('different keys produce different hashes', () => {
    const hash1 = hashKey('exe_sk_key_one_testhash');
    const hash2 = hashKey('exe_sk_key_two_testhash');
    expect(hash1).not.toBe(hash2);
  });
});
