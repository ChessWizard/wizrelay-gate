import Link from 'next/link';
import { isAdmin, isOwner } from '@/core/auth/roles';
import { requireUser } from '@/services/auth/context';
import { prisma } from '@/services/db/client';
import { activeContext } from '@/services/panel/active';
import { claudeAvailable } from '@/services/engine/claude';
import { cliAvailable } from '@/services/cli/wizrelay';
import { getLocale } from '@/services/panel/locale';
import { createTranslator } from '@/shared/i18n/translate';
import { Icon } from '@/shared/ui/icons';
import { Panel, Row } from '@/shared/ui/primitives';

interface Todo {
  id: string;
  labelKey: string;
  href: string;
  done: boolean;
}

/** What is still missing, and where to fix it. Hidden once nothing is. */
export async function TodoList({ compact = false }: { compact?: boolean }) {
  const { user, viewer } = await requireUser();
  const t = createTranslator(await getLocale());

  const [context, connections, hasCli, hasClaude, people, account] = await Promise.all([
    activeContext(),
    prisma.connection.findMany({ where: { userId: user.id } }),
    cliAvailable(),
    claudeAvailable(),
    prisma.user.count(),
    prisma.user.findUnique({ where: { id: user.id }, select: { passwordSetAt: true } }),
  ]);

  const has = (kind: 'GITHUB' | 'CLICKUP') =>
    connections.some((row) => row.kind === kind && row.secretEnc);

  const todos: Todo[] = [];

  if (account?.passwordSetAt === null) {
    todos.push({ id: 'password', labelKey: 'todo.setPassword', href: '/settings', done: false });
  }

  if (isAdmin(viewer)) {
    todos.push({
      id: 'hub',
      labelKey: 'todo.connectHub',
      href: isOwner(viewer) ? '/setup' : '/admin',
      done: context.hubs.length > 0,
    });
    todos.push({
      id: 'project',
      labelKey: 'todo.addProject',
      href: isOwner(viewer) ? '/setup' : '/admin',
      done: context.projects.length > 0,
    });
    todos.push({
      id: 'people',
      labelKey: 'todo.addPeople',
      href: '/admin',
      done: people > 1,
    });
  }

  todos.push({ id: 'clickup', labelKey: 'todo.connectClickUp', href: '/connections', done: has('CLICKUP') });
  todos.push({ id: 'github', labelKey: 'todo.connectGitHub', href: '/connections', done: has('GITHUB') });
  todos.push({ id: 'claude', labelKey: 'todo.connectClaude', href: '/connections', done: hasClaude });
  todos.push({ id: 'cli', labelKey: 'ready.cli', href: '/connections', done: hasCli });

  const open = todos.filter((todo) => !todo.done);
  if (compact && open.length === 0) return null;

  return (
    <Panel
      title={t('todo.title')}
      aside={
        <span className="mono xs t3">
          {todos.length - open.length}/{todos.length}
        </span>
      }
    >
      <ol className="csteps" data-tour="todo">
        {todos.map((todo) => (
          <li className={`cstep ${todo.done ? 's-passed' : 's-idle'}`} key={todo.id}>
            <span className="cdot">
              <Icon name={todo.done ? 'passed' : 'idle'} />
            </span>
            <Row gap={8}>
              <span className="sm">{t(todo.labelKey as 'todo.connectHub')}</span>
              {todo.done ? null : (
                <Link className="xs" href={todo.href}>
                  {t('todo.open')}
                </Link>
              )}
            </Row>
          </li>
        ))}
      </ol>
    </Panel>
  );
}
