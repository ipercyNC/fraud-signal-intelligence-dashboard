import { Line, LineChart, ResponsiveContainer } from 'recharts';
import { fraudRateSparkline, headerKpis } from '../../data/mockKpis';

function toneClass(tone: 'neutral' | 'alert' | 'good' = 'neutral') {
  if (tone === 'alert') return 'text-rose-700';
  if (tone === 'good') return 'text-emerald-700';
  return 'text-slate-900';
}

export function KpiHeader() {
  return (
    <header className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="grid gap-3 md:grid-cols-4">
        {headerKpis.map((kpi) => (
          <article key={kpi.label} className="rounded-md bg-slate-50 p-3">
            <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{kpi.label}</p>
            <p className={`mt-1 text-xl font-semibold ${toneClass(kpi.tone)}`}>{kpi.value}</p>
          </article>
        ))}
      </div>
      <div className="mt-4 h-12 w-full">
        <ResponsiveContainer>
          <LineChart data={fraudRateSparkline}>
            <Line type="monotone" dataKey="value" stroke="#0f766e" strokeWidth={2} dot={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </header>
  );
}
