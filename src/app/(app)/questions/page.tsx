import { AppShell } from '@/features/shell/components/app-shell';
import { QuestionsScreen } from '@/features/questions/components/questions-screen';

export default async function QuestionsPage({
  searchParams,
}: {
  searchParams: Promise<{ side?: string }>;
}) {
  const { side } = await searchParams;

  return (
    <AppShell>
      <QuestionsScreen side={side} />
    </AppShell>
  );
}
