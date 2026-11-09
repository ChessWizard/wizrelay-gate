import { prisma } from '@/services/db/client';
import { readBrandFile } from '@/services/panel/brand-files';

/**
 * The panel's logo or favicon, read from its branding directory.
 *
 * A route rather than a path under `public/` because `public/` is part of the image: a
 * team that installs from a container cannot put a file in it, and anything written
 * there at runtime is gone on the next deploy. The directory this reads is the volume
 * that already survives one.
 */
export const dynamic = 'force-dynamic';

const KINDS = new Set(['logo', 'favicon']);

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ kind: string }> },
): Promise<Response> {
  const { kind } = await params;
  if (!KINDS.has(kind)) return new Response('not found', { status: 404 });

  let recorded: string | null = null;
  try {
    const panel = await prisma.panel.findUnique({ where: { id: 'panel' } });
    recorded = kind === 'logo' ? (panel?.logoFile ?? null) : (panel?.faviconFile ?? null);
  } catch {
    recorded = null;
  }

  const image = await readBrandFile(kind as 'logo' | 'favicon', recorded);
  if (!image) return new Response('not found', { status: 404 });

  return new Response(new Uint8Array(image.data), {
    headers: {
      'Content-Type': image.mime,
      'Content-Length': String(image.data.byteLength),
      'Cache-Control': 'public, max-age=31536000, immutable',
    },
  });
}
