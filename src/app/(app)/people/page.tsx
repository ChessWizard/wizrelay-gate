import { AppShell } from '@/features/shell/components/app-shell';
import { PeopleScreen } from '@/features/people/components/people-screen';

export default function PeoplePage() {
  return (
    <AppShell>
      <PeopleScreen />
    </AppShell>
  );
}
