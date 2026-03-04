import type { AppView } from '../store';
import { useAppStore } from '../store';

const views: AppView[] = ['Live Queue', 'Signal Library', 'Analytics', 'Case History'];

export function Navigation() {
  const activeView = useAppStore((state) => state.activeView);
  const setActiveView = useAppStore((state) => state.setActiveView);
  const logout = useAppStore((state) => state.logout);

  return (
    <aside className="flex h-full flex-col rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <h1 className="mb-4 text-sm font-semibold uppercase tracking-wide text-slate-500">Fraud Ops</h1>
      <nav className="space-y-2">
        {views.map((view) => {
          const isActive = activeView === view;
          return (
            <button
              key={view}
              type="button"
              onClick={() => setActiveView(view)}
              className={`w-full rounded-md px-3 py-2 text-left text-sm font-medium transition ${
                isActive
                  ? 'bg-teal-700 text-white shadow'
                  : 'bg-slate-50 text-slate-700 hover:bg-slate-100'
              }`}
            >
              {view}
            </button>
          );
        })}
      </nav>
      <button
        type="button"
        onClick={logout}
        className="mt-auto rounded-md border border-slate-200 px-3 py-2 text-left text-sm font-medium text-slate-700 hover:bg-slate-50"
      >
        Logout
      </button>
    </aside>
  );
}
