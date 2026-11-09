import { AppShell } from '@/features/shell/components/app-shell';
import { NewRelayForm } from '@/features/packages/components/new-relay-form';

export default function NewRelayPage() {
  return (
    <AppShell>
      <NewRelayForm />
    </AppShell>
  );
}
