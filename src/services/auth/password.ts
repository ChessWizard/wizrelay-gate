import { randomBytes, scrypt as scryptCallback, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';

const scrypt = promisify(scryptCallback) as (
  password: string,
  salt: Buffer,
  keylen: number,
) => Promise<Buffer>;

const KEY_LENGTH = 64;

/** Hash a password as `scrypt$<salt>$<key>`, both base64. */
export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const key = await scrypt(password, salt, KEY_LENGTH);
  return `scrypt$${salt.toString('base64')}$${key.toString('base64')}`;
}

export async function verifyPassword(password: string, stored: string | null): Promise<boolean> {
  if (!stored) return false;
  const [scheme, saltPart, keyPart] = stored.split('$');
  if (scheme !== 'scrypt' || !saltPart || !keyPart) return false;

  const expected = Buffer.from(keyPart, 'base64');
  const actual = await scrypt(password, Buffer.from(saltPart, 'base64'), expected.length);
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

export type { PasswordRule } from '@/core/auth/password-rule';
export { checkPassword } from '@/core/auth/password-rule';
