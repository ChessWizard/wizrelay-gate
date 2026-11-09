/**
 * The link back to the ticket a package came from.
 *
 * `task.json` carries `tracker.url` when the hub wrote one, and that is always the
 * answer: it is the tracker's own link, whatever tracker it is. The rules below only
 * cover the trackers whose URL can be rebuilt from a reference alone, for packages
 * written before the hub started recording the link. Anything else returns null and the
 * reference is shown as text — a guessed URL that 404s is worse than no link.
 */
export interface TrackerRef {
  type: string;
  ref: string;
  url?: string;
}

const GITHUB_REF = /^([\w.-]+)\/([\w.-]+)#(\d+)$/;

export function trackerUrl(tracker: TrackerRef | undefined): string | null {
  if (!tracker) return null;

  const explicit = tracker.url?.trim();
  if (explicit && /^https?:\/\//i.test(explicit)) return explicit;

  const ref = tracker.ref?.trim();
  if (!ref) return null;

  switch (tracker.type?.toLowerCase()) {
    case 'clickup':
      return `https://app.clickup.com/t/${encodeURIComponent(ref.replace(/^CU-/i, ''))}`;
    case 'github': {
      const match = GITHUB_REF.exec(ref);
      return match ? `https://github.com/${match[1]}/${match[2]}/issues/${match[3]}` : null;
    }
    default:
      return null;
  }
}

/** What to print for the ticket, with or without a link behind it. */
export function trackerLabel(tracker: TrackerRef | undefined): string {
  return tracker?.ref?.trim() || '';
}
