import { AppShell } from '@/features/shell/components/app-shell';
import { InboxScreen } from '@/features/inbox/components/inbox-screen';

export default async function InboxPage() {
  return (
    <AppShell>
      <InboxScreen />
    </AppShell>
  );
}
