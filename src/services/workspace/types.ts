import type { RepoProfile } from '@/core/routing/routing';

export type Direction = 'a' | 'b';
export type ThemeChoice = 'light' | 'dark' | 'system';
export type Locale = 'en' | 'tr';

export interface Appearance {
  direction: Direction;
  theme: ThemeChoice;
}

export interface HubConnection {
  /** `git@github.com:acme/research-hub.git`, or an https URL. */
  url: string;
  /** A local working copy, which the plugin prefers over the cache when `hub.path` is set. */
  path?: string;
  branch: string;
  name?: string;
  language?: Locale;
  tracker?: { type: string; id_prefix?: string };
  roles?: string[];
  lastFetch?: string;
  reachable?: boolean;
  error?: string;
}

export interface RepoConnection {
  id: string;
  path: string;
  role: string;
  /** `acme/api-service`, read from the git remote when there is one. */
  repo?: string;
  baseRef?: string;
  profile?: RepoProfile & { stack?: string; commands?: Record<string, string> };
}

export interface Workspace {
  schema_version: 1;
  /** `demo` runs on the bundled sample workspace; `live` talks to real repositories. */
  mode: 'demo' | 'live';
  initialized: boolean;
  locale: Locale;
  appearance: Appearance;
  hub?: HubConnection;
  repos: RepoConnection[];
  notifications: { needsYou: boolean; questionAnswered: boolean; ciFinished: boolean };
  createdAt: string;
  updatedAt: string;
}

export const DEFAULT_WORKSPACE: Workspace = {
  schema_version: 1,
  mode: 'demo',
  initialized: false,
  locale: 'en',
  appearance: { direction: 'a', theme: 'dark' },
  repos: [],
  notifications: { needsYou: true, questionAnswered: false, ciFinished: false },
  createdAt: '1970-01-01T00:00:00.000Z',
  updatedAt: '1970-01-01T00:00:00.000Z',
};

/** A patch may change one corner of `appearance` or `notifications` without the rest. */
export type WorkspacePatch = Partial<Omit<Workspace, 'appearance' | 'notifications'>> & {
  appearance?: Partial<Appearance>;
  notifications?: Partial<Workspace['notifications']>;
};
