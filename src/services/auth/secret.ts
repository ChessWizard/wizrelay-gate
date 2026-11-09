import { createHash } from 'node:crypto';

/** The server key behind session tokens and stored third-party secrets. */
export function serverSecret(): Buffer {
  const value = process.env.AUTH_SECRET;
  if (!value || value.length < 16) {
    throw new Error('AUTH_SECRET is not set. Generate one with: openssl rand -base64 48');
  }
  return createHash('sha256').update(value).digest();
}

export function hasServerSecret(): boolean {
  return Boolean(process.env.AUTH_SECRET && process.env.AUTH_SECRET.length >= 16);
}
