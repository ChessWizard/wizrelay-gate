import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';
import { serverSecret } from './secret';

/** Encrypt a third-party token for storage as `v1.<iv>.<tag>.<cipher>`, all base64url. */
export function encryptSecret(plain: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', serverSecret(), iv);
  const encrypted = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  return [
    'v1',
    iv.toString('base64url'),
    cipher.getAuthTag().toString('base64url'),
    encrypted.toString('base64url'),
  ].join('.');
}

export function decryptSecret(stored: string | null | undefined): string | null {
  if (!stored) return null;
  const [version, ivPart, tagPart, dataPart] = stored.split('.');
  if (version !== 'v1' || !ivPart || !tagPart || !dataPart) return null;
  try {
    const decipher = createDecipheriv('aes-256-gcm', serverSecret(), Buffer.from(ivPart, 'base64url'));
    decipher.setAuthTag(Buffer.from(tagPart, 'base64url'));
    return Buffer.concat([
      decipher.update(Buffer.from(dataPart, 'base64url')),
      decipher.final(),
    ]).toString('utf8');
  } catch {
    return null;
  }
}

/** Show a stored token without revealing it. */
export function maskSecret(plain: string): string {
  if (plain.length <= 8) return '••••';
  return `${plain.slice(0, 4)}••••${plain.slice(-4)}`;
}
