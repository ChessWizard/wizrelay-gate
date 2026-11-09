import { PrismaClient } from '@prisma/client';

/** One Prisma client per process, kept on globalThis so dev reloads reuse it. */
const store = globalThis as typeof globalThis & { __wizrelayGatePrisma?: PrismaClient };

export const prisma: PrismaClient =
  store.__wizrelayGatePrisma ??
  new PrismaClient({ log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'] });

if (process.env.NODE_ENV !== 'production') store.__wizrelayGatePrisma = prisma;
