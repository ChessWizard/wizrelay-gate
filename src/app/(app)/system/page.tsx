import { AppShell } from '@/features/shell/components/app-shell';
import { SystemScreen } from '@/features/system/components/system-screen';

export default function SystemPage() {
  return (
    <AppShell>
      <SystemScreen />
    </AppShell>
  );
}
