import { z } from 'zod';
import type { AuditReport, SkippedAudit } from '@/core/audit/types';
import type { ExecResult } from '@/services/shell/exec';
import { BinaryMissing, run, which } from '@/services/shell/exec';

/**
 * The wizrelay CLI adapter.
 *
 * Every deterministic result the dashboard shows comes from here. The dashboard never
 * reimplements a scope decision, a validation rule or a tier: it asks the CLI and renders
 * the answer, and it shows the command it ran so the two can never silently disagree.
 */

export const statusSchema = z.object({
  schema_version: z.number(),
  persona: z.string(),
  root: z.string().nullable(),
  role: z.string().nullable().optional(),
  task: z
    .object({
      id: z.string(),
      title: z.string(),
      version: z.number(),
      status: z.string(),
      enforcement: z.string(),
      active_source: z.string().optional(),
      scope: z.object({ allow: z.array(z.string()), deny: z.array(z.string()) }).partial().optional(),
    })
    .nullable(),
  routing: z
    .object({ tier: z.string(), score: z.number(), phases: z.record(z.string(), z.unknown()), launch: z.string() })
    .optional(),
  warnings: z.array(z.string()).default([]),
});

export type CliStatus = z.infer<typeof statusSchema>;

export const routeSchema = z.object({
  schema_version: z.number(),
  task_id: z.string().nullable(),
  role: z.string().nullable(),
  signals: z.record(z.string(), z.string()),
  modifiers: z.array(z.string()).default([]),
  tier: z.string(),
  score: z.number(),
  phases: z.record(
    z.string(),
    z.object({ model: z.string(), effort: z.string(), advisor: z.string().optional() }),
  ),
  launch: z.string(),
});

export type CliRoute = z.infer<typeof routeSchema>;

export const doctorSchema = z.object({
  schema_version: z.number(),
  wizrelay: z.string(),
  persona: z.string(),
  root: z.string().nullable(),
  platform: z.string(),
  python: z.string(),
  checks: z.array(
    z.object({ name: z.string(), level: z.enum(['error', 'warn', 'info']), detail: z.string() }),
  ),
  errors: z.number(),
  warnings: z.number(),
});

export type CliDoctor = z.infer<typeof doctorSchema>;

export const hubListSchema = z.object({
  schema_version: z.number(),
  packages: z.array(
    z.object({
      id: z.string().optional(),
      folder: z.string().optional(),
      title: z.string().optional(),
      version: z.number().optional(),
      status: z.string().optional(),
      roles: z.array(z.string()).optional(),
    }),
  ),
});

export type CliHubList = z.infer<typeof hubListSchema>;

export interface CliCall<T> {
  ok: boolean;
  /** Present when the CLI answered and the payload validated. */
  data?: T;
  /** The command as typed, always shown in the UI. */
  command: string;
  exitCode?: number;
  stderr?: string;
  /** Set when `wizrelay` is not installed — the dashboard then says so and falls back. */
  unavailable?: boolean;
  parseError?: string;
}

export async function cliAvailable(): Promise<boolean> {
  return (await which('wizrelay')) !== null;
}

async function call<T>(
  args: string[],
  cwd: string,
  schema: z.ZodType<T>,
  acceptExitCodes: number[] = [0],
): Promise<CliCall<T>> {
  let result: ExecResult;
  try {
    result = await run('wizrelay', args, { cwd, timeoutMs: 60_000 });
  } catch (error) {
    if (error instanceof BinaryMissing) {
      return { ok: false, command: `wizrelay ${args.join(' ')}`, unavailable: true };
    }
    throw error;
  }

  if (!acceptExitCodes.includes(result.code)) {
    return {
      ok: false,
      command: result.command,
      exitCode: result.code,
      stderr: result.stderr.trim() || result.stdout.trim(),
    };
  }

  try {
    const parsed = schema.parse(JSON.parse(result.stdout));
    return { ok: true, data: parsed, command: result.command, exitCode: result.code };
  } catch (error) {
    return {
      ok: false,
      command: result.command,
      exitCode: result.code,
      parseError: error instanceof Error ? error.message : String(error),
    };
  }
}

export function status(cwd: string): Promise<CliCall<CliStatus>> {
  return call(['status', '--json'], cwd, statusSchema);
}

export function route(cwd: string): Promise<CliCall<CliRoute>> {
  return call(['route', '--json'], cwd, routeSchema);
}

export function doctor(cwd: string): Promise<CliCall<CliDoctor>> {
  return call(['doctor', '--json'], cwd, doctorSchema, [0, 1]);
}

export function hubList(cwd: string): Promise<CliCall<CliHubList>> {
  return call(['hub', 'list', '--json'], cwd, hubListSchema);
}

const integritySchema = z.object({
  changed: z.array(z.string()),
  missing: z.array(z.string()),
  unlocked: z.array(z.string()),
});

const auditSchema: z.ZodType<AuditReport | SkippedAudit> = z.union([
  z.object({ schema_version: z.number(), skipped: z.literal(true), reason: z.string() }),
  z.object({
    schema_version: z.number(),
    task_id: z.string().nullable(),
    role: z.string().nullable(),
    enforcement: z.string(),
    scope_defined: z.boolean(),
    base: z.string().nullable(),
    base_available: z.boolean(),
    in_scope: z.array(z.string()),
    out_of_scope: z.array(z.string()),
    forbidden: z.array(z.object({ path: z.string(), pattern: z.string() })),
    incidental: z.array(z.string()),
    integrity: integritySchema.nullable(),
    violations: z.number(),
    clean: z.boolean(),
    notes: z.array(z.string()),
  }),
]);

export function audit(
  cwd: string,
  options: { base?: string; task?: string; branch?: string } = {},
): Promise<CliCall<AuditReport | SkippedAudit>> {
  const args = ['audit', '--format', 'json', '--no-fail'];
  if (options.base) args.push('--base', options.base);
  if (options.task) args.push('--task', options.task);
  if (options.branch) args.push('--branch', options.branch);
  return call(args, cwd, auditSchema);
}

/** `wizrelay hub validate` is text, not JSON: its lines carry `file:line` and a level. */
export interface ValidationLine {
  level: 'error' | 'warning';
  message: string;
  loc?: string;
}

export async function hubValidate(
  cwd: string,
  reference: string,
): Promise<CliCall<ValidationLine[]>> {
  let result: ExecResult;
  const args = ['hub', 'validate', reference, '--no-fail'];
  try {
    result = await run('wizrelay', args, { cwd, timeoutMs: 120_000 });
  } catch (error) {
    if (error instanceof BinaryMissing) {
      return { ok: false, command: `wizrelay ${args.join(' ')}`, unavailable: true };
    }
    throw error;
  }

  const lines: ValidationLine[] = [];
  for (const raw of result.stdout.split('\n')) {
    const line = raw.trim();
    if (!line) continue;
    const match = /^(error|warning|warn)\b[:\s-]*(.*)$/i.exec(line);
    if (!match) continue;
    const location = /([\w./-]+\.(?:md|json)(?::\d+)?)/.exec(match[2]);
    lines.push({
      level: match[1].toLowerCase().startsWith('error') ? 'error' : 'warning',
      message: match[2].trim(),
      loc: location?.[1],
    });
  }
  return { ok: true, data: lines, command: result.command, exitCode: result.code };
}
