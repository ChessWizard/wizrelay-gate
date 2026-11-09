import { mkdir, readdir, readFile, unlink, writeFile } from 'node:fs/promises';
import { extname, join } from 'node:path';
import { storeRoot } from '@/services/store/store';

/**
 * Where the panel keeps its logo and favicon.
 *
 * On the panel's own data directory — the volume a container install already mounts —
 * rather than in the database or in `public/`, which is baked into the image and lost on
 * every redeploy. That gives two ways in and one place to look: upload through the
 * panel, or drop `logo.png` and `favicon.ico` into the volume before the first start.
 */
export type BrandKind = 'logo' | 'favicon';

const EXTENSIONS: Record<string, string> = {
  'image/png': '.png',
  'image/jpeg': '.jpg',
  'image/webp': '.webp',
  'image/svg+xml': '.svg',
  'image/x-icon': '.ico',
  'image/vnd.microsoft.icon': '.ico',
};

const MIME_TYPES: Record<string, string> = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
};

export function brandingDir(): string {
  return join(storeRoot(), 'branding');
}

export function extensionFor(mime: string): string | null {
  return EXTENSIONS[mime] ?? null;
}

export function mimeFor(file: string): string | null {
  return MIME_TYPES[extname(file).toLowerCase()] ?? null;
}

/** Write an uploaded image and return its file name; the previous one is removed. */
export async function saveBrandFile(
  kind: BrandKind,
  data: Buffer,
  mime: string,
): Promise<string | null> {
  const extension = extensionFor(mime);
  if (!extension) return null;

  const directory = brandingDir();
  await mkdir(directory, { recursive: true });
  await removeBrandFiles(kind);

  const name = `${kind}${extension}`;
  await writeFile(join(directory, name), data);
  return name;
}

export async function removeBrandFiles(kind: BrandKind): Promise<void> {
  const directory = brandingDir();
  let names: string[];
  try {
    names = await readdir(directory);
  } catch {
    return;
  }
  for (const name of names) {
    if (name.startsWith(`${kind}.`)) {
      try {
        await unlink(join(directory, name));
      } catch {
      }
    }
  }
}

/**
 * The file in use for one kind: the one the panel recorded, or — for an operator who
 * mounted an image without ever opening the panel — whatever `logo.*` is sitting there.
 */
export async function findBrandFile(kind: BrandKind, recorded?: string | null): Promise<string | null> {
  const directory = brandingDir();
  let names: string[];
  try {
    names = await readdir(directory);
  } catch {
    return null;
  }
  if (recorded && names.includes(recorded)) return recorded;
  return names.find((name) => name.startsWith(`${kind}.`) && mimeFor(name) !== null) ?? null;
}

export async function readBrandFile(
  kind: BrandKind,
  recorded?: string | null,
): Promise<{ data: Buffer; mime: string } | null> {
  const name = await findBrandFile(kind, recorded);
  if (!name) return null;
  const mime = mimeFor(name);
  if (!mime) return null;
  try {
    return { data: await readFile(join(brandingDir(), name)), mime };
  } catch {
    return null;
  }
}
