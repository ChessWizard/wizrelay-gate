/**
 * Which package files the panel may write, and where.
 *
 * Writing into a package is the one place the panel stops being a window onto the work
 * and becomes a hand in it, so the rules are here, in one pure place, rather than spread
 * through an action.
 *
 * Three refusals, and each one has happened to somebody:
 *
 * * **A path that climbs out.** `path` arrives from the browser, and `../../.ssh/config`
 *   is a path. Everything is resolved and checked against the package folder.
 * * **A file nobody owns here.** `task.json` is the tracker's record and `.validation.md`
 *   is the validator's output; hand-editing either makes the tooling disagree with
 *   itself. A generated file is not a document.
 * * **Somebody else's half.** The researcher owns the research; the developer owns the
 *   plan, the questions and the verification. Editing across that line is how two people
 *   overwrite each other with no commit in between.
 */

/** Written by a tool, read by everything. Not a document somebody edits. */
export const GENERATED = ['task.json', '.validation.md', '.lock.json'];

export type Owner = 'researcher' | 'developer';

export interface WriteRefusal {
  ok: false;
  reasonKey:
    | 'package.write.outside'
    | 'package.write.generated'
    | 'package.write.notYours'
    | 'package.write.unreadable';
}

export type WriteVerdict = { ok: true } | WriteRefusal;

/** Markdown only: the package is prose, and the generated JSON is already refused. */
export function editable(path: string): boolean {
  return path.endsWith('.md');
}

/**
 * Whether this path names a file inside the package folder.
 *
 * Checked on the relative path before anything touches the filesystem: a segment of `..`,
 * an absolute path and a Windows drive letter are all refused, and so is a backslash,
 * because a path separator that this code does not recognise is one the filesystem might.
 */
export function insidePackage(path: string): boolean {
  const raw = path.trim();
  if (!raw || raw.length > 200) return false;
  if (raw.startsWith('/') || raw.startsWith('\\') || /^[A-Za-z]:/.test(raw)) return false;
  if (raw.includes('\\') || raw.includes('\0')) return false;

  const parts = raw.split('/');
  if (parts.some((part) => part === '' || part === '.' || part === '..')) return false;

  return true;
}

export function mayWrite(path: string, owner: Owner, actsAs: Owner[]): WriteVerdict {
  if (!insidePackage(path)) return { ok: false, reasonKey: 'package.write.outside' };
  if (GENERATED.includes(path)) return { ok: false, reasonKey: 'package.write.generated' };
  if (!editable(path)) return { ok: false, reasonKey: 'package.write.unreadable' };
  if (!actsAs.includes(owner)) return { ok: false, reasonKey: 'package.write.notYours' };
  return { ok: true };
}
