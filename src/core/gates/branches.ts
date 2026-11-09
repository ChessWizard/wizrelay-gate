/**
 * The branch a task's research lives on while it is being written.
 *
 * Research used to be committed straight onto the hub's main branch, which meant a
 * half-written package was on the branch everybody reads the moment it was pushed, and
 * there was no way to show somebody a draft without publishing it. A task gets a branch
 * of its own, named after the task, and the hub's main branch only ever receives work
 * that has been through the delivery side.
 *
 * The name is derived rather than stored so that every step of every gate agrees on it
 * without the panel having to remember a decision it can recompute.
 */
export function hubTaskBranch(folder: string): string {
  const clean = folder
    .trim()
    .replace(/[^A-Za-z0-9._/-]+/g, '-')
    .replace(/^[-.]+|[-.]+$/g, '')
    .slice(0, 80)
    .replace(/[-.]+$/g, '');

  return `research/${clean || 'task'}`;
}
