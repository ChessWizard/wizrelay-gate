import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

/**
 * The image is how this panel reaches a server, so the pieces that make it reachable are
 * checked like code.
 *
 * Everything here has one failure mode in common: it is invisible until somebody deploys.
 * A variable the documentation promises and compose never passes, a build context that
 * drags a local database into the image, a migration that is on disk and not in the
 * image — none of them fail a test suite, and all of them fail a first install.
 */
const dockerfile = readFileSync('Dockerfile', 'utf8');
const compose = readFileSync('docker-compose.yml', 'utf8');
const ignore = readFileSync('.dockerignore', 'utf8');
const example = readFileSync('.env.example', 'utf8');

const names = (text: string) => [...text.matchAll(/^[A-Z][A-Z0-9_]*(?==)/gm)].map((m) => m[0]);

describe('the compose file and the documented environment', () => {
  it('passes every variable the example environment offers', () => {
    const missing = names(example).filter((key) => !compose.includes(`${key}:`));
    expect(missing).toEqual([]);
  });

  it('runs one service, with the database inside it', () => {
    expect(compose).not.toMatch(/image:\s*postgres/);
    expect(compose).toContain('gate-data:/data');
  });

  it(`defaults to gates running on people own machines`, () => {
    expect(compose).toContain('WIZRELAY_GATE_EXECUTION: ${WIZRELAY_GATE_EXECUTION:-agent}');
  });
});

describe('the build context', () => {
  it('leaves local state and build output out of the image', () => {
    for (const path of ['node_modules', '.next', '.next-verify', '.wizrelay-gate', '.git', '.env']) {
      expect(ignore, path).toContain(path);
    }
  });
});

describe('the image', () => {
  it('carries what the app needs at run time', () => {
    // `public` is not part of Next's standalone output, and the agent lives there: a
    // panel that cannot serve its own agent cannot be paired with.
    expect(dockerfile).toContain('/app/public ./public');
    expect(dockerfile).toContain('/app/prisma ./prisma');
    expect(dockerfile).toContain('/app/.next/static');
  });

  it('can apply its own migrations', () => {
    // The traced standalone output has no Prisma CLI, so it gets a tree of its own.
    expect(dockerfile).toContain('/opt/prisma/node_modules');
  });

  it('has the programs the gates shell out to', () => {
    for (const binary of ['git', 'python3', 'openssh-client']) {
      expect(dockerfile, binary).toContain(binary);
    }
  });

  it('answers a health check, with room for a first boot', () => {
    expect(dockerfile).toMatch(/HEALTHCHECK[^\n]*--start-period=60s/);
    expect(dockerfile).toContain('/api/health');
  });

  it('runs as a user rather than as root', () => {
    expect(dockerfile).toContain('chown -R node:node /data');
    expect(readFileSync('docker/entrypoint.sh', 'utf8')).toContain('su-exec node');
  });
});
