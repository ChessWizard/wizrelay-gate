import type { SVGProps } from 'react';
import { cn } from '@/shared/lib/cn';

/**
 * One outline set, drawn on a 16-unit grid, stroked with `currentColor`. The paths are
 * the ones in the design canvas's Foundations artboard.
 */
export const ICON_PATHS = {
  idle: 'M8 2.5a5.5 5.5 0 1 0 0 11a5.5 5.5 0 1 0 0-11z',
  running: 'M13.5 8A5.5 5.5 0 1 1 8 2.5',
  waiting:
    'M8 7.5a2.25 2.25 0 1 0 0-4.5a2.25 2.25 0 1 0 0 4.5zM3.5 13.5c.6-2.4 2.3-3.75 4.5-3.75s3.9 1.35 4.5 3.75',
  handoff: 'M4.5 2.5h7M4.5 13.5h7M5.5 2.5v1.5L8 8l2.5-4V2.5M5.5 13.5V12L8 8l2.5 4v1.5',
  passed: 'M3.5 8.5l3 3 6-7',
  warned: 'M8 2.5l6 11H2zM8 6.5v3M8 11.5v.01',
  failed: 'M4.5 4.5l7 7M11.5 4.5l-7 7',
  blocked: 'M4.5 7.5h7v6h-7zM6 7.5V5.5a2 2 0 0 1 4 0v2',
  skipped: 'M3 8h7M8 5l3 3-3 3M13 4v8',
  guard: 'M8 2l5 2v4c0 3-2.2 5-5 6-2.8-1-5-3-5-6V4zM2.5 2.5l11 11',
  board: 'M2.5 2.5h4.5v4.5H2.5zM9 2.5h4.5v4.5H9zM2.5 9h4.5v4.5H2.5zM9 9h4.5v4.5H9z',
  relay: 'M2 8h3l1.5-3 3 6L11 8h3',
  package: 'M4 2.5h5.5L12 5v8.5H4zM9.5 2.5V5H12',
  questions: 'M2.5 3.5h11v7h-6l-3 2.5v-2.5h-2z',
  settings:
    'M8 5.5a2.5 2.5 0 1 0 0 5a2.5 2.5 0 1 0 0-5zM8 1.5v2M8 12.5v2M1.5 8h2M12.5 8h2M3.4 3.4l1.4 1.4M11.2 11.2l1.4 1.4M3.4 12.6l1.4-1.4M11.2 4.8l1.4-1.4',
  search: 'M7 2.5a4.5 4.5 0 1 0 0 9a4.5 4.5 0 1 0 0-9zM10.5 10.5l3 3',
  copy: 'M5.5 5.5h7v8h-7zM3.5 10.5v-8h7',
  external: 'M9 2.5h4.5V7M13.5 2.5L7.5 8.5M11.5 9.5v4h-9v-9h4',
  terminal: 'M2.5 3h11v10h-11zM5 6.5l2 1.5-2 1.5M8.5 10h3',
  branch: 'M5 2.5v11M5 10.5c0-3 6-2 6-5.5M11 2.5a1.5 1.5 0 1 0 0 3a1.5 1.5 0 1 0 0-3z',
  upload: 'M8 10.5V2.5M5 5.5l3-3 3 3M2.5 10.5v3h11v-3',
  filter: 'M2.5 3.5h11L9 8.5v4l-2 1v-5z',
  bell: 'M4 11V7a4 4 0 0 1 8 0v4l1 1.5H3zM6.5 14h3',
  shield: 'M8 2l5 2v4c0 3-2.2 5-5 6-2.8-1-5-3-5-6V4z',
  lock: 'M4.5 7.5h7v6h-7zM6 7.5V5.5a2 2 0 0 1 4 0v2',
  chevron: 'M6 4l4 4-4 4',
  chevronDown: 'M4.5 6.5L8 10l3.5-3.5',
  plus: 'M8 3v10M3 8h10',
  stop: 'M4.5 4.5h7v7h-7z',
  attach: 'M11 6.5L7 10.5a1.8 1.8 0 0 1-2.5-2.5l4.5-4.5a3 3 0 0 1 4.2 4.2L8.5 12.5',
  user: 'M8 7.5a2.25 2.25 0 1 0 0-4.5a2.25 2.25 0 1 0 0 4.5zM3.5 13.5c.6-2.4 2.3-3.75 4.5-3.75s3.9 1.35 4.5 3.75',
  cpu: 'M4.5 4.5h7v7h-7zM6.5 2.5v2M9.5 2.5v2M6.5 11.5v2M9.5 11.5v2',
  check: 'M4.5 6.5L8 10l3.5-3.5',
  close: 'M4.5 4.5l7 7M11.5 4.5l-7 7',
  people:
    'M6 7a2 2 0 1 0 0-4a2 2 0 1 0 0 4zM1.5 13c.5-2.1 2-3.3 4.5-3.3S10 10.9 10.5 13M10.8 3.3a2 2 0 0 1 0 3.9M11.8 9.9c1.4.4 2.3 1.5 2.7 3.1',
  pulse: 'M1.5 8.5h3L6 5l2.5 6L10 8.5h4.5',
  clock: 'M8 2.5a5.5 5.5 0 1 0 0 11a5.5 5.5 0 1 0 0-11zM8 5v3.2l2.2 1.3',
  play: 'M5.5 3.5l7 4.5-7 4.5z',
  refresh: 'M13.5 8A5.5 5.5 0 1 1 8 2.5c2 0 3.7 1 4.7 2.6M13.5 2.5v3h-3',
  commit: 'M8 5.5a2.5 2.5 0 1 0 0 5a2.5 2.5 0 1 0 0-5zM1.5 8h4M10.5 8h4',
  hub: 'M8 2.5a2 2 0 1 0 0 4a2 2 0 1 0 0-4zM3.5 13.5a2 2 0 1 0 0-4a2 2 0 1 0 0 4zM12.5 13.5a2 2 0 1 0 0-4a2 2 0 1 0 0 4zM7 6.2L4.4 9.6M9 6.2l2.6 3.4',
  help: 'M8 2.5a5.5 5.5 0 1 0 0 11a5.5 5.5 0 1 0 0-11zM6.3 6.2a1.8 1.8 0 0 1 3.4.8c0 1.2-1.7 1.4-1.7 2.5M8 11.6v.01',
  trash: 'M3.5 4.5h9M6.5 4.5V2.5h3v2M4.5 4.5l.7 9h5.6l.7-9M6.8 7v4M9.2 7v4',
  image: 'M2.5 3.5h11v9h-11zM2.5 10l3-2.5 2.5 2 2.5-2.5 3 3',
  sidebar: 'M2.5 2.5h11v11h-11zM6.5 2.5v11',
  dot: 'M8 6.5a1.5 1.5 0 1 0 0 3a1.5 1.5 0 1 0 0-3z',
  eye: 'M1.5 8s2.4-4 6.5-4 6.5 4 6.5 4-2.4 4-6.5 4-6.5-4-6.5-4zM8 6a2 2 0 1 0 0 4a2 2 0 1 0 0-4z',
  eyeOff: 'M6.3 6.3A2 2 0 0 0 8 10a2 2 0 0 0 1.7-1M4 4.2C2.4 5.3 1.5 8 1.5 8s2.4 4 6.5 4c1.2 0 2.2-.3 3.1-.8M7 4.1a6.6 6.6 0 0 1 1-.1c4.1 0 6.5 4 6.5 4a12 12 0 0 1-2 2.3M2 2l12 12',
  globe:
    'M8 2a6 6 0 1 0 0 12A6 6 0 0 0 8 2zM2.3 8h11.4M8 2.2c1.6 1.7 2.4 3.6 2.4 5.8S9.6 12.1 8 13.8c-1.6-1.7-2.4-3.6-2.4-5.8S6.4 3.9 8 2.2z',
} as const;

export type IconName = keyof typeof ICON_PATHS;

export interface IconProps extends Omit<SVGProps<SVGSVGElement>, 'name'> {
  name: IconName;
  size?: 16 | 20 | 24;
  /** A label makes the icon meaningful to a screen reader; without one it is decorative. */
  label?: string;
}

export function Icon({ name, size = 16, label, className, ...rest }: IconProps) {
  return (
    <svg
      className={cn('i', size === 20 && 'i20', size === 24 && 'i24', className)}
      viewBox="0 0 16 16"
      role={label ? 'img' : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      {...rest}
    >
      <path d={ICON_PATHS[name]} />
    </svg>
  );
}

/** The product mark: a relay baton drawn as a signal. */
export function Mark({ className }: { className?: string }) {
  return (
    <svg className={cn('i i24', className)} viewBox="0 0 24 24" aria-hidden="true">
      <path d="M3 12h4l2-5 3 10 2-5h7" />
    </svg>
  );
}
