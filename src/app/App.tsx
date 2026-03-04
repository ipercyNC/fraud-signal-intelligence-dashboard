import { Suspense, lazy, useEffect } from 'react';
import { AppShell } from './layout/AppShell';
import { useAppStore } from './store';
import { LoadingState } from './components/ViewStates';
import { LoginGate } from './components/LoginGate';

const AnalyticsView = lazy(async () =>
  import('../views/analytics/AnalyticsView').then((module) => ({ default: module.AnalyticsView })),
);
const CaseHistoryView = lazy(async () =>
  import('../views/case-history/CaseHistoryView').then((module) => ({ default: module.CaseHistoryView })),
);
const LiveQueueView = lazy(async () =>
  import('../views/live-queue/LiveQueueView').then((module) => ({ default: module.LiveQueueView })),
);
const SignalLibraryView = lazy(async () =>
  import('../views/signal-library/SignalLibraryView').then((module) => ({ default: module.SignalLibraryView })),
);

function ActiveView() {
  const activeView = useAppStore((state) => state.activeView);

  switch (activeView) {
    case 'Signal Library':
      return <SignalLibraryView />;
    case 'Analytics':
      return <AnalyticsView />;
    case 'Case History':
      return <CaseHistoryView />;
    case 'Live Queue':
    default:
      return <LiveQueueView />;
  }
}

export function App() {
  const bootstrap = useAppStore((state) => state.bootstrap);
  const loading = useAppStore((state) => state.loading);
  const bootstrapError = useAppStore((state) => state.bootstrapError);
  const apiWritable = useAppStore((state) => state.apiWritable);

  useEffect(() => {
    void bootstrap();
  }, [bootstrap]);

  if (loading) {
    return (
      <div className="min-h-screen p-4 lg:p-6">
        <div className="mx-auto max-w-[720px]">
          <LoadingState title="Loading investigation workspace" detail="Fetching applications, rules, and case data." />
        </div>
      </div>
    );
  }

  if (!apiWritable) {
    return (
      <div className="min-h-screen p-4 lg:p-6">
        <div className="mx-auto max-w-[720px]">
          <LoginGate detail={bootstrapError} />
        </div>
      </div>
    );
  }

  return (
    <AppShell>
      <Suspense fallback={<LoadingState title="Loading view" detail="Preparing workspace module." />}>
        <ActiveView />
      </Suspense>
    </AppShell>
  );
}
