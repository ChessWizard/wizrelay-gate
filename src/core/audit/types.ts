/**
 * `wizrelay audit --format json`, field for field. The dashboard renders this; it never
 * computes a scope decision itself.
 */
export interface IntegrityReport {
  changed: string[];
  missing: string[];
  unlocked: string[];
}

export interface AuditReport {
  schema_version: number;
  task_id: string | null;
  role: string | null;
  enforcement: string;
  scope_defined: boolean;
  base: string | null;
  base_available: boolean;
  in_scope: string[];
  out_of_scope: string[];
  forbidden: { path: string; pattern: string }[];
  incidental: string[];
  integrity: IntegrityReport | null;
  violations: number;
  clean: boolean;
  notes: string[];
}

export interface SkippedAudit {
  schema_version: number;
  skipped: true;
  reason: string;
}

export function isSkipped(report: AuditReport | SkippedAudit): report is SkippedAudit {
  return 'skipped' in report && report.skipped === true;
}

export function integrityClean(integrity: IntegrityReport | null): boolean {
  if (!integrity) return true;
  return (
    integrity.changed.length === 0 &&
    integrity.missing.length === 0 &&
    integrity.unlocked.length === 0
  );
}

export function changedTotal(report: AuditReport): number {
  return (
    report.in_scope.length +
    report.out_of_scope.length +
    report.forbidden.length +
    report.incidental.length
  );
}
