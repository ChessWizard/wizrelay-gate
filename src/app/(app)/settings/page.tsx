import { AppShell } from '@/features/shell/components/app-shell';
import { SettingsScreen } from '@/features/settings/components/settings-screen';

export default function SettingsPage() {
  return (
    <AppShell>
      <SettingsScreen />
    </AppShell>
  );
}
