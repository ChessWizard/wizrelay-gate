import { AppShell } from '@/features/shell/components/app-shell';
import { SetupScreen } from '@/features/setup/components/setup-screen';

export default async function SetupPage() {
  return (
    <AppShell>
      <SetupScreen />
    </AppShell>
  );
}
