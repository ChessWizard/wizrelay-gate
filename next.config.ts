import type { NextConfig } from 'next';

/**
 * wizrelay-gate runs on the user's own machine and talks to the local `wizrelay` CLI,
 * local git repositories and the local filesystem. Nothing is sent anywhere else, so
 * there is no analytics, no telemetry and no remote image host.
 */
const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  /**
   * No dev overlay badge. The dashboard is looked at as a product while it is being built
   * — screenshots, a second monitor, someone else's desk — and a floating framework badge
   * in the corner is part of the page to everyone except the person who put it there.
   * Build errors still appear; only the idle indicator goes.
   */
  devIndicators: false,
  /**
   * The container runs `node server.js` from the traced standalone output rather than the
   * whole repository: a smaller image, and nothing in it the app does not import.
   */
  output: 'standalone',
  /**
   * A second build, beside the one already running.
   *
   * Verifying a change means running it, and the panel is usually already up on this
   * machine — serving `.next` from the last build. Building into it would take that
   * instance down mid-sentence. `WIZRELAY_GATE_DIST` gives a verification build somewhere
   * else to live; nothing sets it in normal use.
   */
  distDir: process.env.WIZRELAY_GATE_DIST || '.next',
  // The engine and CLI adapters shell out to `wizrelay`, `git` and `claude`; they must
  // stay on the Node runtime and never be bundled for the edge.
  serverExternalPackages: [],
  /**
   * The agent a machine downloads before it pairs. It is a static file — reading it
   * through a route handler would make the build trace the whole project to find it — so
   * it is served from `public/` and this only gives it the short address people type.
   */
  async rewrites() {
    return [{ source: '/agent', destination: '/wizrelay-agent.mjs' }];
  },
  /**
   * The relay list moved out from under `/packages`.
   *
   * Here rather than in a page that redirects: this answers before anything renders, with
   * a real 308 and the query string intact, so a link somebody saved still lands on their
   * search rather than on a blank page that then navigates itself.
   */
  async redirects() {
    return [
      { source: '/packages', destination: '/relays', permanent: true },
      { source: '/packages/new', destination: '/relays/new', permanent: true },
    ];
  },
  experimental: {
    // Server actions carry gate answers and approvals; keep the payload small and local.
    serverActions: { bodySizeLimit: '8mb' },
  },
};

export default nextConfig;
