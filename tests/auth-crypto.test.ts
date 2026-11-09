import { beforeAll, describe, expect, it } from 'vitest';

beforeAll(() => {
  process.env.AUTH_SECRET = 'test-secret-value-that-is-long-enough';
});

const { checkPassword, hashPassword, verifyPassword } = await import('@/services/auth/password');
const { decryptSecret, encryptSecret, maskSecret } = await import('@/services/auth/crypto');

describe('passwords', () => {
  it('verifies the password it hashed, and nothing else', async () => {
    const stored = await hashPassword('correct horse battery');
    expect(await verifyPassword('correct horse battery', stored)).toBe(true);
    expect(await verifyPassword('wrong horse battery', stored)).toBe(false);
  });

  it('produces a different hash every time, so two equal passwords do not match on sight', async () => {
    const a = await hashPassword('same password here');
    const b = await hashPassword('same password here');
    expect(a).not.toBe(b);
    expect(await verifyPassword('same password here', b)).toBe(true);
  });

  it('refuses a missing or malformed hash rather than throwing', async () => {
    expect(await verifyPassword('anything', null)).toBe(false);
    expect(await verifyPassword('anything', 'not-a-hash')).toBe(false);
    expect(await verifyPassword('anything', 'scrypt$only-one-part')).toBe(false);
  });

  it('asks for a password worth having', () => {
    expect(checkPassword('short1').ok).toBe(false);
    expect(checkPassword('alllettersnodigits').ok).toBe(false);
    expect(checkPassword('long enough with 1 digit').ok).toBe(true);
  });
});

describe('stored third-party tokens', () => {
  it('comes back the way it went in', () => {
    const token = 'pk_live_abcdef0123456789';
    expect(decryptSecret(encryptSecret(token))).toBe(token);
  });

  it('encrypts the same token differently each time', () => {
    expect(encryptSecret('same')).not.toBe(encryptSecret('same'));
  });

  it('returns null for anything it cannot read, rather than throwing', () => {
    expect(decryptSecret(null)).toBeNull();
    expect(decryptSecret('')).toBeNull();
    expect(decryptSecret('v1.broken')).toBeNull();
    expect(decryptSecret('v9.a.b.c')).toBeNull();
  });

  it('refuses a tampered payload', () => {
    const stored = encryptSecret('secret-value');
    const [version, iv, tag] = stored.split('.');
    expect(decryptSecret(`${version}.${iv}.${tag}.ZGlmZmVyZW50`)).toBeNull();
  });

  it('shows a token without revealing it', () => {
    expect(maskSecret('pk_live_abcdef0123456789')).toBe('pk_l••••6789');
    expect(maskSecret('short')).toBe('••••');
  });
});
