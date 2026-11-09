import { NextResponse } from 'next/server';
import { prisma } from '@/services/db/client';
import { hasServerSecret } from '@/services/auth/secret';
import { which } from '@/services/shell/exec';

export const dynamic = 'force-dynamic';

export async function GET() {
  let database = false;
  try {
    await prisma.$queryRaw`SELECT 1`;
    database = true;
  } catch {
    database = false;
  }

  const [git, python, wizrelay, claude] = await Promise.all([
    which('git'),
    which('python3'),
    which('wizrelay'),
    which('claude'),
  ]);

  const ok = database && hasServerSecret();

  return NextResponse.json(
    {
      status: ok ? 'ok' : 'degraded',
      database,
      secret: hasServerSecret(),
      tools: {
        git: Boolean(git),
        python3: Boolean(python),
        wizrelay: Boolean(wizrelay),
        claude: Boolean(claude),
      },
    },
    { status: ok ? 200 : 503 },
  );
}
