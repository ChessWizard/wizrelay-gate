import { mkdirSync, mkdtempSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

/**
 * The branding directory, on disk.
 *
 * `WIZRELAY_GATE_HOME` decides where the store lives and is read when the module loads,
 * so it is set before the import rather than after.
 */
const ROOT = mkdtempSync(join(tmpdir(), 'wizrelay-gate-brand-'));
process.env.WIZRELAY_GATE_HOME = ROOT;

const { brandingDir, findBrandFile, readBrandFile, removeBrandFiles, saveBrandFile } = await import(
  '@/services/panel/brand-files'
);

const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

beforeAll(() => {
  mkdirSync(brandingDir(), { recursive: true });
});

beforeEach(async () => {
  await removeBrandFiles('logo');
  await removeBrandFiles('favicon');
});

afterAll(() => {
  rmSync(ROOT, { recursive: true, force: true });
});

describe('the branding directory', () => {
  it('sits under the panel data directory, which is the mounted volume', () => {
    expect(brandingDir()).toBe(join(ROOT, 'branding'));
  });

  it('writes an upload under a name taken from its type', async () => {
    expect(await saveBrandFile('logo', PNG, 'image/png')).toBe('logo.png');
    expect(readdirSync(brandingDir())).toContain('logo.png');
  });

  it('refuses a type no browser would render', async () => {
    expect(await saveBrandFile('logo', PNG, 'application/pdf')).toBeNull();
  });

  it('replaces the previous image rather than leaving two behind', async () => {
    await saveBrandFile('logo', PNG, 'image/png');
    await saveBrandFile('logo', PNG, 'image/webp');
    const names = readdirSync(brandingDir()).filter((name) => name.startsWith('logo.'));
    expect(names).toEqual(['logo.webp']);
  });

  it('leaves the other kind alone', async () => {
    await saveBrandFile('favicon', PNG, 'image/x-icon');
    await saveBrandFile('logo', PNG, 'image/png');
    await removeBrandFiles('logo');
    expect(await findBrandFile('favicon')).toBe('favicon.ico');
  });

  it('finds a file the operator dropped in without ever opening the panel', async () => {
    writeFileSync(join(brandingDir(), 'logo.svg'), '<svg/>');
    expect(await findBrandFile('logo', null)).toBe('logo.svg');
  });

  it('ignores a recorded name whose file is gone', async () => {
    expect(await findBrandFile('logo', 'logo.png')).toBeNull();
  });

  it('reads the image back with the type the extension implies', async () => {
    await saveBrandFile('logo', PNG, 'image/png');
    const image = await readBrandFile('logo', 'logo.png');
    expect(image?.mime).toBe('image/png');
    expect(image?.data.equals(PNG)).toBe(true);
  });

  it('has nothing to say when nothing was ever set', async () => {
    expect(await readBrandFile('favicon', null)).toBeNull();
  });
});
