import { prisma } from '@/services/db/client';
import { findBrandFile } from './brand-files';

/**
 * How this installation presents itself.
 *
 * Three ways in, in this order: an image in the panel's branding directory — uploaded
 * here, or mounted into the volume by whoever ran the container — then a link typed into
 * the panel, then the environment. A team that cannot edit the source can still put its
 * own name and mark on the thing.
 */
export interface Branding {
  name: string;
  /** What this panel is, in the operator's own words. Empty falls back to the default. */
  description: string | null;
  logoUrl: string | null;
  faviconUrl: string | null;
  accent: string | null;
}

export const DEFAULT_BRANDING: Branding = {
  name: 'wizrelay-gate',
  description: null,
  logoUrl: null,
  faviconUrl: null,
  accent: null,
};

function fromEnv(): Branding {
  return {
    name: process.env.PANEL_NAME?.trim() || DEFAULT_BRANDING.name,
    description: process.env.PANEL_DESCRIPTION?.trim() || null,
    logoUrl: process.env.PANEL_LOGO_URL?.trim() || null,
    faviconUrl: process.env.PANEL_FAVICON_URL?.trim() || null,
    accent: process.env.PANEL_ACCENT?.trim() || null,
  };
}

/**
 * An uploaded image wins over a typed link, which wins over the environment. The version
 * in the URL is what lets the answer be cached forever and still change on the next
 * upload.
 */
export async function branding(): Promise<Branding> {
  const base = fromEnv();
  try {
    const panel = await prisma.panel.findUnique({ where: { id: 'panel' } });
    if (!panel) return base;
    const version = panel.brandVersion;
    const [logo, favicon] = await Promise.all([
      findBrandFile('logo', panel.logoFile),
      findBrandFile('favicon', panel.faviconFile),
    ]);
    return {
      name: panel.name?.trim() || base.name,
      description: panel.description?.trim() || base.description,
      logoUrl: logo ? `/api/brand/logo?v=${version}` : panel.logoUrl?.trim() || base.logoUrl,
      faviconUrl: favicon
        ? `/api/brand/favicon?v=${version}`
        : panel.faviconUrl?.trim() || base.faviconUrl,
      accent: base.accent,
    };
  } catch {
    return base;
  }
}
