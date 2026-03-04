import { useMemo, useState } from 'react';
import { useAppStore } from '../../app/store';
import type { ScoredApplication, SignalCategory } from '../../domain/types';
import { EmptyState } from '../../app/components/ViewStates';

function riskClass(score: number): string {
  if (score >= 75) return 'bg-rose-100 text-rose-700';
  if (score >= 40) return 'bg-amber-100 text-amber-800';
  return 'bg-emerald-100 text-emerald-700';
}

type RiskFilter = 'All' | 'High' | 'Medium' | 'Low';
type SignalFilter = 'All' | SignalCategory;

function matchesRisk(application: ScoredApplication, risk: RiskFilter): boolean {
  if (risk === 'All') return true;
  return application.riskBand === risk;
}

function matchesSignal(application: ScoredApplication, signal: SignalFilter): boolean {
  if (signal === 'All') return true;
  return application.signalResults.some((result) => result.triggered && result.category === signal);
}

const PAGE_SIZE = 50;

export function LiveQueueView() {
  const scoredApplications = useAppStore((state) => state.scoredApplications);
  const selectedApplicationId = useAppStore((state) => state.selectedApplicationId);
  const setSelectedApplicationId = useAppStore((state) => state.setSelectedApplicationId);

  const [riskFilter, setRiskFilter] = useState<RiskFilter>('All');
  const [signalFilter, setSignalFilter] = useState<SignalFilter>('All');
  const [productFilter, setProductFilter] = useState('All');
  const [stateFilter, setStateFilter] = useState('All');
  const [agentFilter, setAgentFilter] = useState('All');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [coverageMin, setCoverageMin] = useState('');
  const [coverageMax, setCoverageMax] = useState('');
  const [page, setPage] = useState(1);

  const products = useMemo(() => ['All', ...new Set(scoredApplications.map((app) => app.product))], [scoredApplications]);
  const states = useMemo(
    () => ['All', ...new Set(scoredApplications.map((app) => app.applicant.address.state))],
    [scoredApplications],
  );
  const agents = useMemo(() => ['All', ...new Set(scoredApplications.map((app) => app.agent.id))], [scoredApplications]);

  const filteredRows = useMemo(() => {
    return scoredApplications
      .filter((app) => matchesRisk(app, riskFilter))
      .filter((app) => matchesSignal(app, signalFilter))
      .filter((app) => productFilter === 'All' || app.product === productFilter)
      .filter((app) => stateFilter === 'All' || app.applicant.address.state === stateFilter)
      .filter((app) => agentFilter === 'All' || app.agent.id === agentFilter)
      .filter((app) => {
        if (!dateFrom) return true;
        return new Date(app.timestamps.submittedAt) >= new Date(dateFrom);
      })
      .filter((app) => {
        if (!dateTo) return true;
        return new Date(app.timestamps.submittedAt) <= new Date(`${dateTo}T23:59:59`);
      })
      .filter((app) => {
        if (!coverageMin) return true;
        return app.financial.coverageAmount >= Number(coverageMin);
      })
      .filter((app) => {
        if (!coverageMax) return true;
        return app.financial.coverageAmount <= Number(coverageMax);
      })
      .sort((a, b) => b.riskScore - a.riskScore);
  }, [agentFilter, coverageMax, coverageMin, dateFrom, dateTo, productFilter, riskFilter, signalFilter, stateFilter]);

  const totalPages = Math.max(1, Math.ceil(filteredRows.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);

  const pagedRows = useMemo(() => {
    const start = (currentPage - 1) * PAGE_SIZE;
    return filteredRows.slice(start, start + PAGE_SIZE);
  }, [currentPage, filteredRows]);

  return (
    <section className="h-full rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-lg font-semibold text-slate-900">Live Queue</h2>
        <p className="text-xs uppercase tracking-wide text-slate-500">{filteredRows.length} Results</p>
      </div>

      <div className="mb-4 grid gap-2 md:grid-cols-3 xl:grid-cols-5">
        <select value={riskFilter} onChange={(event) => { setRiskFilter(event.target.value as RiskFilter); setPage(1); }} className="rounded border border-slate-200 px-2 py-1 text-sm">
          <option value="All">Risk: All</option>
          <option value="High">Risk: High</option>
          <option value="Medium">Risk: Medium</option>
          <option value="Low">Risk: Low</option>
        </select>
        <select value={signalFilter} onChange={(event) => { setSignalFilter(event.target.value as SignalFilter); setPage(1); }} className="rounded border border-slate-200 px-2 py-1 text-sm">
          <option value="All">Signal: All</option>
          <option value="Identity">Identity</option>
          <option value="Velocity">Velocity</option>
          <option value="Behavioral">Behavioral</option>
          <option value="Financial">Financial</option>
          <option value="Agent">Agent</option>
        </select>
        <select value={productFilter} onChange={(event) => { setProductFilter(event.target.value); setPage(1); }} className="rounded border border-slate-200 px-2 py-1 text-sm">
          {products.map((product) => (
            <option key={product} value={product}>
              Product: {product}
            </option>
          ))}
        </select>
        <select value={agentFilter} onChange={(event) => { setAgentFilter(event.target.value); setPage(1); }} className="rounded border border-slate-200 px-2 py-1 text-sm">
          {agents.map((agent) => (
            <option key={agent} value={agent}>
              Agent: {agent}
            </option>
          ))}
        </select>
        <select value={stateFilter} onChange={(event) => { setStateFilter(event.target.value); setPage(1); }} className="rounded border border-slate-200 px-2 py-1 text-sm">
          {states.map((state) => (
            <option key={state} value={state}>
              State: {state}
            </option>
          ))}
        </select>
      </div>

      <div className="mb-4 grid gap-2 md:grid-cols-2 xl:grid-cols-4">
        <label className="text-xs text-slate-500">
          Date From
          <input type="date" value={dateFrom} onChange={(event) => { setDateFrom(event.target.value); setPage(1); }} className="mt-1 w-full rounded border border-slate-200 px-2 py-1 text-sm text-slate-700" />
        </label>
        <label className="text-xs text-slate-500">
          Date To
          <input type="date" value={dateTo} onChange={(event) => { setDateTo(event.target.value); setPage(1); }} className="mt-1 w-full rounded border border-slate-200 px-2 py-1 text-sm text-slate-700" />
        </label>
        <label className="text-xs text-slate-500">
          Coverage Min
          <input type="number" value={coverageMin} onChange={(event) => { setCoverageMin(event.target.value); setPage(1); }} className="mt-1 w-full rounded border border-slate-200 px-2 py-1 text-sm text-slate-700" placeholder="100000" />
        </label>
        <label className="text-xs text-slate-500">
          Coverage Max
          <input type="number" value={coverageMax} onChange={(event) => { setCoverageMax(event.target.value); setPage(1); }} className="mt-1 w-full rounded border border-slate-200 px-2 py-1 text-sm text-slate-700" placeholder="2000000" />
        </label>
      </div>

      {filteredRows.length === 0 && (
        <EmptyState
          title="No queue rows match current filters"
          detail="Adjust risk, signal, date, or coverage filters to expand results."
        />
      )}

      {filteredRows.length > 0 && (
        <>
          <div className="overflow-auto">
            <table className="min-w-full border-collapse text-left text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-slate-500">
                  <th className="px-2 py-2">Application</th>
                  <th className="px-2 py-2">Timestamp</th>
                  <th className="px-2 py-2">Product</th>
                  <th className="px-2 py-2">Coverage</th>
                  <th className="px-2 py-2">Risk</th>
                  <th className="px-2 py-2">Top Signal</th>
                  <th className="px-2 py-2">Agent</th>
                </tr>
              </thead>
              <tbody>
                {pagedRows.map((row) => {
                  const isSelected = selectedApplicationId === row.id;
                  return (
                    <tr
                      key={row.id}
                      onClick={() => setSelectedApplicationId(row.id)}
                      className={`cursor-pointer border-b border-slate-100 align-top ${
                        isSelected ? 'bg-teal-50' : 'hover:bg-slate-50'
                      }`}
                    >
                      <td className="px-2 py-2 font-medium text-slate-900">{row.applicant.maskedName}</td>
                      <td className="px-2 py-2 text-slate-700">{new Date(row.timestamps.submittedAt).toLocaleString()}</td>
                      <td className="px-2 py-2 text-slate-700">{row.product}</td>
                      <td className="px-2 py-2 text-slate-700">${row.financial.coverageAmount.toLocaleString()}</td>
                      <td className="px-2 py-2">
                        <span className={`rounded px-2 py-1 text-xs font-semibold ${riskClass(row.riskScore)}`}>
                          {row.riskScore} ({row.riskBand})
                        </span>
                      </td>
                      <td className="px-2 py-2 text-slate-700">{row.topSignal}</td>
                      <td className="px-2 py-2 text-slate-700">{row.agent.id}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="mt-3 flex items-center justify-between text-xs text-slate-600">
            <p>
              Page {currentPage} of {totalPages}
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setPage((value) => Math.max(1, value - 1))}
                disabled={currentPage === 1}
                className="rounded border border-slate-200 px-2 py-1 disabled:opacity-40"
              >
                Prev
              </button>
              <button
                type="button"
                onClick={() => setPage((value) => Math.min(totalPages, value + 1))}
                disabled={currentPage === totalPages}
                className="rounded border border-slate-200 px-2 py-1 disabled:opacity-40"
              >
                Next
              </button>
            </div>
          </div>
        </>
      )}
    </section>
  );
}
