import clsx from 'clsx';
import type { ClassValue } from 'clsx';

/** The design system is class-based, so composing classes is the main styling act. */
export function cn(...values: ClassValue[]): string {
  return clsx(values);
}
