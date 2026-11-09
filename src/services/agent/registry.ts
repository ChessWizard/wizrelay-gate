import { createHmac, randomBytes, randomInt, timingSafeEqual } from 'node:crypto';
import type { Agent } from '@prisma/client';
import type { AgentHello, AgentRepoReport } from '@/core/agent/protocol';
import {
  HUB_ROLE,
  PAIRING_ALPHABET,
  PAIRING_CODE_LENGTH,
  PAIRING_TTL_MS,
  isAgentOnline,
  normalisePairingCode,
} from '@/core/agent/protocol';
import { prisma } from '@/services/db/client';
import { serverSecret } from '@/services/auth/secret';

/**
 * The register of machines.
 *
 * Pairing is a code read off the panel and typed into a terminal, which is the shape this
 * has to take: the machine has no browser session and the panel has no way to reach the
 * machine. The code is short-lived and single-use; what it buys is a bearer token, stored
 * only as an HMAC here and in a `chmod 600` file there.
 *
 * Nothing in this module runs a command. It answers two questions — which machines does
 * this person have, and is this token one of them — and records what a machine last said
 * about itself.
 */

function digest(value: string): string {
  return createHmac('sha256', serverSecret()).update(value).digest('base64url');
}

function sameDigest(left: string, right: string): boolean {
  const a = Buffer.from(left);
  const b = Buffer.from(right);
  return a.length === b.length && timingSafeEqual(a, b);
}

/** A code a person can read off a screen without mistaking O for 0. */
function newPairingCode(): string {
  let code = '';
  for (let index = 0; index < PAIRING_CODE_LENGTH; index += 1) {
    code += PAIRING_ALPHABET[randomInt(PAIRING_ALPHABET.length)];
  }
  return code;
}

export interface PairingOffer {
  code: string;
  expiresAt: Date;
}

/**
 * Open a pairing window for one person.
 *
 * Any code they had and have not used is dropped first: two live codes mean two machines
 * could pair from one intention, and the one on screen should always be the only one that
 * works.
 */
export async function openPairing(userId: string, label?: string): Promise<PairingOffer> {
  await prisma.agentPairing.deleteMany({ where: { userId, usedAt: null } });

  const code = newPairingCode();
  const expiresAt = new Date(Date.now() + PAIRING_TTL_MS);
  await prisma.agentPairing.create({
    data: { userId, codeHash: digest(code), label: label ?? null, expiresAt },
  });
  return { code, expiresAt };
}

export async function cancelPairing(userId: string): Promise<void> {
  await prisma.agentPairing.deleteMany({ where: { userId, usedAt: null } });
}

/** The live offer for this person, without revealing the code the row cannot give back. */
export async function pendingPairing(userId: string): Promise<{ expiresAt: Date } | null> {
  const row = await prisma.agentPairing.findFirst({
    where: { userId, usedAt: null, expiresAt: { gt: new Date() } },
    orderBy: { createdAt: 'desc' },
  });
  return row ? { expiresAt: row.expiresAt } : null;
}

export interface PairedAgent {
  agent: Agent;
  token: string;
  userName: string;
  userEmail: string;
}

/**
 * Redeem a code. The token is returned once and never stored in a readable form, so a
 * machine that loses it pairs again rather than asking for it back.
 */
export async function redeemPairing(input: {
  code: string;
  hostname: string;
  platform: string;
  agentVersion: string;
  protocol: number;
}): Promise<PairedAgent | null> {
  const code = normalisePairingCode(input.code);
  if (code.length !== PAIRING_CODE_LENGTH) return null;

  const row = await prisma.agentPairing.findUnique({
    where: { codeHash: digest(code) },
    include: { user: true },
  });
  if (!row || row.usedAt || row.expiresAt < new Date() || row.user.disabled) return null;

  const token = randomBytes(32).toString('base64url');
  const name = row.label?.trim() || input.hostname || 'machine';

  const [, agent] = await prisma.$transaction([
    prisma.agentPairing.update({ where: { id: row.id }, data: { usedAt: new Date() } }),
    prisma.agent.create({
      data: {
        userId: row.userId,
        name,
        tokenHash: digest(token),
        hostname: input.hostname,
        platform: input.platform,
        version: input.agentVersion,
        protocol: input.protocol,
        lastSeenAt: new Date(),
      },
    }),
  ]);

  return { agent, token, userName: row.user.name, userEmail: row.user.email };
}

/** The agent behind a bearer token, or null. Revoked and disabled both read as null. */
export async function agentForToken(token: string | null | undefined): Promise<Agent | null> {
  if (!token) return null;
  const hash = digest(token);
  const agent = await prisma.agent.findUnique({ where: { tokenHash: hash }, include: { user: true } });
  if (!agent || agent.revokedAt || agent.user.disabled) return null;
  return sameDigest(agent.tokenHash, hash) ? agent : null;
}

/** The bearer token from an `Authorization` header, or null. */
export function bearer(header: string | null): string | null {
  if (!header) return null;
  const [scheme, value] = header.split(' ');
  return scheme?.toLowerCase() === 'bearer' && value ? value.trim() : null;
}

function reportedRepos(value: unknown): AgentRepoReport[] {
  if (!Array.isArray(value)) return [];
  const out: AgentRepoReport[] = [];
  for (const entry of value) {
    const row = entry as Partial<AgentRepoReport>;
    if (typeof row?.role === 'string' && typeof row?.path === 'string') {
      out.push({
        role: row.role,
        path: row.path,
        repo: typeof row.repo === 'string' ? row.repo : undefined,
        branch: typeof row.branch === 'string' ? row.branch : undefined,
      });
    }
  }
  return out;
}

export function reposOf(agent: Pick<Agent, 'repos'>): AgentRepoReport[] {
  return reportedRepos(agent.repos);
}

/** The working copy this agent offers for a role, or for the hub itself. */
export function workingCopyOf(agent: Pick<Agent, 'repos'>, role: string | undefined): string | undefined {
  const wanted = role ?? HUB_ROLE;
  return reposOf(agent).find((entry) => entry.role === wanted)?.path;
}

/** Every folder this agent declared, which is the only place a job may run. */
export function rootsOf(agent: Pick<Agent, 'repos'>): string[] {
  return reposOf(agent).map((entry) => entry.path);
}

/** Record what a machine says about itself. This is also the heartbeat. */
export async function recordHello(agentId: string, hello: AgentHello): Promise<Agent> {
  return prisma.agent.update({
    where: { id: agentId },
    data: {
      hostname: hello.hostname,
      platform: hello.platform,
      version: hello.agentVersion,
      protocol: hello.protocol,
      repos: reportedRepos(hello.repos) as unknown as object,
      binaries: (hello.binaries ?? {}) as unknown as object,
      claudeEmail: hello.claude?.email ?? null,
      claudeName: hello.claude?.name ?? null,
      lastSeenAt: new Date(),
    },
  });
}

export async function listAgents(userId: string): Promise<Agent[]> {
  return prisma.agent.findMany({
    where: { userId, revokedAt: null },
    orderBy: { lastSeenAt: 'desc' },
  });
}

export async function revokeAgent(userId: string, agentId: string): Promise<boolean> {
  const result = await prisma.agent.updateMany({
    where: { id: agentId, userId, revokedAt: null },
    data: { revokedAt: new Date() },
  });
  return result.count > 0;
}

/**
 * The machine a gate should run on: this person's, online, and holding the working copy
 * the gate needs. A role nobody has checked out is not a machine that will do; saying so
 * here is what lets the gate fail with a sentence instead of a stack trace.
 */
export async function agentFor(
  userId: string,
  role: string | undefined,
): Promise<{ agent: Agent; cwd: string } | null> {
  const agents = await listAgents(userId);
  const online = agents.filter((agent) => isAgentOnline(agent.lastSeenAt));
  for (const agent of online) {
    const cwd = workingCopyOf(agent, role);
    if (cwd) return { agent, cwd };
  }
  return null;
}

/** Whether this person has any machine listening at all, whatever it has checked out. */
export async function hasOnlineAgent(userId: string): Promise<boolean> {
  const agents = await listAgents(userId);
  return agents.some((agent) => isAgentOnline(agent.lastSeenAt));
}

/**
 * The panel's own guess at who an agent belongs to when a person pairs before they have a
 * panel account — the Claude account both sides already know. Unused by pairing itself,
 * which goes through a signed-in session; it is how the UI can say "this machine is signed
 * in to Claude as someone else" rather than letting the mismatch pass silently.
 */
export function claudeMatches(agent: Pick<Agent, 'claudeEmail'>, claudeRef: string | null): boolean {
  if (!agent.claudeEmail || !claudeRef) return true;
  return agent.claudeEmail.toLowerCase() === claudeRef.toLowerCase();
}
