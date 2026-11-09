import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * The layering, enforced the way the plugin enforces its own:
 *
 *   core (pure, no IO) <- services (git, filesystem, processes) <- features <- app
 *
 * A feature may import from core, services and shared; services may not reach up into a
 * feature; core may not reach anywhere but core and itself. This is the test that keeps
 * the screaming-architecture folders honest.
 */
const ROOT = join(process.cwd(), 'src');

function files(directory: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(directory)) {
    const path = join(directory, entry);
    if (statSync(path).isDirectory()) out.push(...files(path));
    else if (/\.tsx?$/.test(path)) out.push(path);
  }
  return out;
}

function importsOf(path: string): string[] {
  const text = readFileSync(path, 'utf8');
  return [...text.matchAll(/from\s+'(@\/[^']+)'/g)].map((match) => match[1]);
}

const LAYER_OF = (path: string): string => {
  const relativePath = relative(ROOT, path);
  return relativePath.split('/')[0];
};

const FORBIDDEN: Record<string, string[]> = {
  core: ['@/services', '@/features', '@/app', '@/shared'],
  services: ['@/features', '@/app'],
  shared: ['@/features', '@/app', '@/services'],
};

describe('the layers', () => {
  const sources = files(ROOT);

  it('finds the source tree', () => {
    expect(sources.length).toBeGreaterThan(40);
  });

  it.each(['core', 'services', 'shared'])('%s imports nothing above it', (layer) => {
    const offences: string[] = [];
    for (const path of sources.filter((candidate) => LAYER_OF(candidate) === layer)) {
      for (const imported of importsOf(path)) {
        if (FORBIDDEN[layer].some((prefix) => imported.startsWith(prefix))) {
          offences.push(`${relative(ROOT, path)} → ${imported}`);
        }
      }
    }
    expect(offences).toEqual([]);
  });

  it('keeps every feature in its own folder', () => {
    const features = readdirSync(join(ROOT, 'features'));
    expect(features.length).toBeGreaterThan(8);
    for (const feature of features) {
      expect(statSync(join(ROOT, 'features', feature)).isDirectory()).toBe(true);
    }
  });

  it('leaves routing to the app folder, which holds no logic', () => {
    for (const path of files(join(ROOT, 'app'))) {
      const text = readFileSync(path, 'utf8');

      expect(text.length, relative(ROOT, path)).toBeLessThan(3_000);
    }
  });
});
