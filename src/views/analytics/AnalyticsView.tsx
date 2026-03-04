import { useMemo, useState } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { useAppStore } from '../../app/store';
import { EmptyState } from '../../app/components/ViewStates';

function weekBucket(dateIso: string): string {
  const date = new Date(dateIso);
  if (Number.isNaN(date.getTime())) return 'Invalid';

  // ISO-8601 week date in UTC to avoid locale-dependent bucket drift.
  const utcDate = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const day = utcDate.getUTCDay() || 7;
  utcDate.setUTCDate(utcDate.getUTCDate() + 4 - day);

  const year = utcDate.getUTCFullYear();
  const yearStart = new Date(Date.UTC(year, 0, 1));
  const week = Math.ceil((((utcDate.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
  return `${year}-W${String(week).padStart(2, '0')}`;
}

function toCsv(rows: Array<Record<string, unknown>>): string {
  if (rows.length === 0) return '';
  const headers = Object.keys(rows[0]);
  const lines = [headers.join(',')];
  for (const row of rows) {
    lines.push(headers.map((header) => JSON.stringify(row[header] ?? '')).join(','));
  }
  return lines.join('\n');
}

export function AnalyticsView() {
  const scoredApplications = useAppStore((state) => state.scoredApplications);
  const casesById = useAppStore((state) => state.casesById);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [productFilter, setProductFilter] = useState('All');

  const products = useMemo(() => ['All', ...new Set(scoredApplications.map((app) => app.product))], [scoredApplications]);

  const filteredApps = useMemo(() => {
    return scoredApplications
      .filter((app) => productFilter === 'All' || app.product === productFilter)
      .filter((app) => {
        if (!dateFrom) return true;
        return new Date(app.timestamps.submittedAt) >= new Date(dateFrom);
      })
      .filter((app) => {
        if (!dateTo) return true;
        return new Date(app.timestamps.submittedAt) <= new Date(`${dateTo}T23:59:59`);
      });
  }, [dateFrom, dateTo, productFilter]);

  const fraudTrend = useMemo(() => {
    const bucket = new Map<string, { week: string; total: number; flagged: number; direct: number; agent: number }>();

    for (const app of filteredApps) {
      const key = weekBucket(app.timestamps.submittedAt);
      const row = bucket.get(key) ?? { week: key, total: 0, flagged: 0, direct: 0, agent: 0 };
      row.total += 1;
      if (app.riskScore >= 40) row.flagged += 1;
      if (app.channel === 'Direct') row.direct += 1;
      if (app.channel !== 'Direct') row.agent += 1;
      bucket.set(key, row);
    }

    return [...bucket.values()]
      .sort((a, b) => a.week.localeCompare(b.week))
      .map((row) => ({
        week: row.week,
        fraudRate: Number(((row.flagged / Math.max(row.total, 1)) * 100).toFixed(1)),
        direct: row.direct,
        assisted: row.agent,
      }));
  }, [filteredApps]);

  const signalHeatmap = useMemo(() => {
    const matrix = new Map<string, Record<string, number>>();
    for (const app of filteredApps) {
      const week = weekBucket(app.timestamps.submittedAt);
      for (const signal of app.signalResults.filter((result) => result.triggered)) {
        const row = matrix.get(signal.signalName) ?? {};
        row[week] = (row[week] ?? 0) + 1;
        matrix.set(signal.signalName, row);
      }
    }

    const weeks = [...new Set(filteredApps.map((app) => weekBucket(app.timestamps.submittedAt)))].sort();

    return {
      weeks,
      rows: [...matrix.entries()].map(([signal, counts]) => ({ signal, counts })),
    };
  }, [filteredApps]);

  const geography = useMemo(() => {
    const map = new Map<string, number>();
    for (const app of filteredApps.filter((item) => item.riskScore >= 40)) {
      map.set(app.applicant.address.state, (map.get(app.applicant.address.state) ?? 0) + 1);
    }
    return [...map.entries()].map(([state, count]) => ({ state, count })).sort((a, b) => b.count - a.count);
  }, [filteredApps]);

  const coverageHistogram = useMemo(() => {
    const bins = [
      { label: '<250k', min: 0, max: 250000, count: 0 },
      { label: '250k-500k', min: 250000, max: 500000, count: 0 },
      { label: '500k-1m', min: 500000, max: 1000000, count: 0 },
      { label: '1m-2m', min: 1000000, max: 2000000, count: 0 },
      { label: '>2m', min: 2000000, max: Number.MAX_SAFE_INTEGER, count: 0 },
    ];

    for (const app of filteredApps.filter((item) => item.riskScore >= 40)) {
      const bin = bins.find((entry) => app.financial.coverageAmount >= entry.min && app.financial.coverageAmount < entry.max);
      if (bin) bin.count += 1;
    }

    return bins;
  }, [filteredApps]);

  const agentOutliers = useMemo(() => {
    const map = new Map<string, { agentId: string; total: number; flagged: number }>();
    for (const app of filteredApps) {
      const row = map.get(app.agent.id) ?? { agentId: app.agent.id, total: 0, flagged: 0 };
      row.total += 1;
      if (app.riskScore >= 40) row.flagged += 1;
      map.set(app.agent.id, row);
    }

    return [...map.values()]
      .map((row) => ({
        ...row,
        flagRate: Number(((row.flagged / Math.max(row.total, 1)) * 100).toFixed(1)),
      }))
      .sort((a, b) => b.flagRate - a.flagRate)
      .slice(0, 8);
  }, [filteredApps]);

  const dispositionTrend = useMemo(() => {
    const map = new Map<string, { week: string; totalHours: number; count: number }>();

    for (const app of filteredApps) {
      const outcome = casesById[app.id];
      if (!outcome || (outcome.finalDisposition !== 'Cleared' && outcome.finalDisposition !== 'Declined')) {
        continue;
      }

      const week = weekBucket(outcome.closedAt);
      const row = map.get(week) ?? { week, totalHours: 0, count: 0 };
      row.totalHours += outcome.timeToDispositionHours;
      row.count += 1;
      map.set(week, row);
    }

    return [...map.values()]
      .sort((a, b) => a.week.localeCompare(b.week))
      .map((row) => ({ week: row.week, avgHours: Number((row.totalHours / Math.max(row.count, 1)).toFixed(1)) }));
  }, [casesById, filteredApps]);

  const exportCsv = () => {
    const rows = filteredApps.map((app) => {
      const outcome = casesById[app.id];
      return {
        applicationId: app.id,
        product: app.product,
        state: app.applicant.address.state,
        channel: app.channel,
        riskScore: app.riskScore,
        topSignal: app.topSignal,
        disposition: outcome?.finalDisposition ?? 'New',
      };
    });

    const csv = toCsv(rows);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = 'fraud-analytics-export.csv';
    anchor.click();
    URL.revokeObjectURL(url);
  };

  return (
    <section className="h-full rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-lg font-semibold text-slate-900">Analytics</h2>
        <button onClick={exportCsv} className="rounded bg-teal-700 px-3 py-1 text-xs font-semibold text-white hover:bg-teal-800">
          Export CSV
        </button>
      </div>

      <div className="mb-4 grid gap-2 md:grid-cols-3">
        <input type="date" value={dateFrom} onChange={(event) => setDateFrom(event.target.value)} className="rounded border border-slate-200 px-2 py-1 text-sm" />
        <input type="date" value={dateTo} onChange={(event) => setDateTo(event.target.value)} className="rounded border border-slate-200 px-2 py-1 text-sm" />
        <select value={productFilter} onChange={(event) => setProductFilter(event.target.value)} className="rounded border border-slate-200 px-2 py-1 text-sm">
          {products.map((product) => (
            <option key={product} value={product}>{product}</option>
          ))}
        </select>
      </div>

      {filteredApps.length === 0 ? (
        <EmptyState title="No analytics data in range" detail="Change date or product filters to include records." />
      ) : (
        <>
          <div className="grid gap-4 lg:grid-cols-2">
            <div className="rounded border border-slate-200 p-3">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Fraud Rate Trend</p>
              <div className="h-52">
                <ResponsiveContainer>
                  <LineChart data={fraudTrend}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="week" />
                    <YAxis />
                    <Tooltip />
                    <Line type="monotone" dataKey="fraudRate" stroke="#be123c" strokeWidth={2} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="rounded border border-slate-200 p-3">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Coverage Distribution (Flagged)</p>
              <div className="h-52">
                <ResponsiveContainer>
                  <BarChart data={coverageHistogram}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="label" />
                    <YAxis allowDecimals={false} />
                    <Tooltip />
                    <Bar dataKey="count" fill="#0f766e" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="rounded border border-slate-200 p-3">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Time To Disposition (Hours)</p>
              <div className="h-52">
                <ResponsiveContainer>
                  <LineChart data={dispositionTrend}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="week" />
                    <YAxis />
                    <Tooltip />
                    <Line type="monotone" dataKey="avgHours" stroke="#1d4ed8" strokeWidth={2} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="rounded border border-slate-200 p-3">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Geography (Flagged by State)</p>
              <div className="h-52">
                {geography.length === 0 ? (
                  <div className="text-xs text-slate-500">No flagged state data for current filters.</div>
                ) : (
                  <ResponsiveContainer>
                    <BarChart data={geography.slice(0, 10)} layout="vertical" margin={{ top: 4, right: 8, left: 0, bottom: 4 }}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis type="number" allowDecimals={false} />
                      <YAxis type="category" dataKey="state" width={28} />
                      <Tooltip />
                      <Bar dataKey="count" fill="#334155" />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </div>
            </div>
          </div>

          <div className="mt-4 grid gap-4 lg:grid-cols-2">
            <div className="rounded border border-slate-200 p-3">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Signal Heatmap</p>
              <div className="overflow-auto">
                <table className="min-w-full text-xs">
                  <thead>
                    <tr>
                      <th className="px-2 py-1 text-left">Signal</th>
                      {signalHeatmap.weeks.map((week) => (
                        <th key={week} className="px-2 py-1 text-right">{week}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {signalHeatmap.rows.slice(0, 10).map((row) => (
                      <tr key={row.signal} className="border-t border-slate-100">
                        <td className="px-2 py-1">{row.signal}</td>
                        {signalHeatmap.weeks.map((week) => (
                          <td key={`${row.signal}-${week}`} className="px-2 py-1 text-right">
                            {row.counts[week] ?? 0}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="rounded border border-slate-200 p-3">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Agent Outlier Table</p>
              <div className="overflow-auto">
                <table className="min-w-full text-xs">
                  <thead>
                    <tr>
                      <th className="px-2 py-1 text-left">Agent</th>
                      <th className="px-2 py-1 text-right">Total</th>
                      <th className="px-2 py-1 text-right">Flagged</th>
                      <th className="px-2 py-1 text-right">Flag Rate</th>
                    </tr>
                  </thead>
                  <tbody>
                    {agentOutliers.map((row) => (
                      <tr key={row.agentId} className="border-t border-slate-100">
                        <td className="px-2 py-1">{row.agentId}</td>
                        <td className="px-2 py-1 text-right">{row.total}</td>
                        <td className="px-2 py-1 text-right">{row.flagged}</td>
                        <td className="px-2 py-1 text-right">{row.flagRate}%</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </>
      )}
    </section>
  );
}
