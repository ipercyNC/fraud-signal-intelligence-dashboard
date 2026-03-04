interface StateProps {
  title: string;
  detail: string;
}

export function LoadingState({ title, detail }: StateProps) {
  return (
    <div className="rounded border border-slate-200 bg-white p-6 text-sm text-slate-600">
      <p className="font-semibold text-slate-800">{title}</p>
      <p className="mt-1">{detail}</p>
    </div>
  );
}

export function EmptyState({ title, detail }: StateProps) {
  return (
    <div className="rounded border border-slate-200 bg-slate-50 p-6 text-sm text-slate-600">
      <p className="font-semibold text-slate-800">{title}</p>
      <p className="mt-1">{detail}</p>
    </div>
  );
}

export function ErrorState({ title, detail }: StateProps) {
  return (
    <div className="rounded border border-rose-200 bg-rose-50 p-6 text-sm text-rose-700">
      <p className="font-semibold">{title}</p>
      <p className="mt-1">{detail}</p>
    </div>
  );
}
