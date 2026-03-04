import type { ReactNode } from 'react';
import { CaseDetailPanel } from './CaseDetailPanel';
import { KpiHeader } from './KpiHeader';
import { Navigation } from './Navigation';

interface AppShellProps {
  children: ReactNode;
}

export function AppShell({ children }: AppShellProps) {
  return (
    <div className="min-h-screen p-4 lg:p-6">
      <div className="mx-auto grid max-w-[1600px] gap-4 lg:grid-cols-[220px_1fr_320px] lg:gap-6">
        <Navigation />
        <main className="flex min-h-[85vh] flex-col gap-4">
          <KpiHeader />
          <div className="flex-1">{children}</div>
        </main>
        <CaseDetailPanel />
      </div>
    </div>
  );
}
