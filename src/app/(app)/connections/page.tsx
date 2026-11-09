import { AppShell } from '@/features/shell/components/app-shell';
import { ConnectionsScreen } from '@/features/connections/components/connections-screen';

export default async function ConnectionsPage() {
  return (
    <AppShell>
      <ConnectionsScreen />
    </AppShell>
  );
}
