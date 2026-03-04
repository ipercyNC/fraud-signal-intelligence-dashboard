import { useEffect, useMemo, useState } from 'react';
import { useAppStore } from '../../app/store';
import type { CaseStatus } from '../../domain/types';
import { EmptyState } from '../../app/components/ViewStates';

export function CaseHistoryView() {
  const scoredApplications = useAppStore((state) => state.scoredApplications);
  const casesById = useAppStore((state) => state.casesById);

  const [selectedId, setSelectedId] = useState<string>(scoredApplications[0]?.id ?? '');
  const [outcomeFilter, setOutcomeFilter] = useState<'All' | CaseStatus>('All');
  const [stateFilter, setStateFilter] = useState('All');
  const [agentFilter, setAgentFilter] = useState('All');
  const [signalFilter, setSignalFilter] = useState('All');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  const states = useMemo(() => ['All', ...new Set(scoredApplications.map((app) => app.applicant.address.state))], [scoredApplications]);
  const agents = useMemo(() => ['All', ...new Set(scoredApplications.map((app) => app.agent.id))], [scoredApplications]);
  const signals = useMemo(() => ['All', ...new Set(scoredApplications.map((app) => app.topSignal))], [scoredApplications]);

  const rows = useMemo(() => {
    return scoredApplications
      .map((app) => {
        const outcome = casesById[app.id];
        if (!outcome) return null;
        return {
          ...outcome,
          app,
          effectiveStatus: outcome.finalDisposition,
        };
      })
      .filter((item): item is NonNullable<typeof item> => Boolean(item))
      .filter((row) => outcomeFilter === 'All' || row.effectiveStatus === outcomeFilter)
      .filter((row) => stateFilter === 'All' || row.app.applicant.address.state === stateFilter)
      .filter((row) => agentFilter === 'All' || row.app.agent.id === agentFilter)
      .filter((row) => signalFilter === 'All' || row.app.topSignal === signalFilter)
      .filter((row) => {
        if (!dateFrom) return true;
        return new Date(row.closedAt) >= new Date(dateFrom);
      })
      .filter((row) => {
        if (!dateTo) return true;
        return new Date(row.closedAt) <= new Date(`${dateTo}T23:59:59`);
      })
      .sort((a, b) => new Date(b.closedAt).getTime() - new Date(a.closedAt).getTime());
  }, [agentFilter, casesById, dateFrom, dateTo, outcomeFilter, scoredApplications, signalFilter, stateFilter]);

  useEffect(() => {
    if (!rows.length) return;
    if (!rows.some((row) => row.applicationId === selectedId)) {
      setSelectedId(rows[0].applicationId);
    }
  }, [rows, selectedId]);

  const selected = rows.find((row) => row.applicationId === selectedId) ?? rows[0];
  const notes = selected ? selected.notes : [];

  return (
    <section className="h-full rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-lg font-semibold text-slate-900">Case History</h2>
        <p className="text-xs uppercase tracking-wide text-slate-500">{rows.length} Closed Cases</p>
      </div>

      <div className="mb-4 grid gap-2 md:grid-cols-3 xl:grid-cols-6">
        <select value={outcomeFilter} onChange={(event) => setOutcomeFilter(event.target.value as 'All' | CaseStatus)} className="rounded border border-slate-200 px-2 py-1 text-sm">
          <option value="All">Outcome: All</option>
          <option value="Cleared">Cleared</option>
          <option value="Escalated">Escalated</option>
          <option value="Declined">Declined</option>
          <option value="In Review">In Review</option>
          <option value="New">New</option>
        </select>
        <select value={stateFilter} onChange={(event) => setStateFilter(event.target.value)} className="rounded border border-slate-200 px-2 py-1 text-sm">
          {states.map((state) => (
            <option key={state} value={state}>State: {state}</option>
          ))}
        </select>
        <select value={agentFilter} onChange={(event) => setAgentFilter(event.target.value)} className="rounded border border-slate-200 px-2 py-1 text-sm">
          {agents.map((agent) => (
            <option key={agent} value={agent}>Agent: {agent}</option>
          ))}
        </select>
        <select value={signalFilter} onChange={(event) => setSignalFilter(event.target.value)} className="rounded border border-slate-200 px-2 py-1 text-sm">
          {signals.map((signal) => (
            <option key={signal} value={signal}>Signal: {signal}</option>
          ))}
        </select>
        <input type="date" value={dateFrom} onChange={(event) => setDateFrom(event.target.value)} className="rounded border border-slate-200 px-2 py-1 text-sm" />
        <input type="date" value={dateTo} onChange={(event) => setDateTo(event.target.value)} className="rounded border border-slate-200 px-2 py-1 text-sm" />
      </div>

      {rows.length === 0 ? (
        <EmptyState title="No closed cases match filters" detail="Adjust outcome, signal, agent, or date filters to see cases." />
      ) : (
        <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
          <div className="overflow-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-slate-500">
                  <th className="px-2 py-2 text-left">Application</th>
                  <th className="px-2 py-2 text-left">Disposition</th>
                  <th className="px-2 py-2 text-left">Closed At</th>
                  <th className="px-2 py-2 text-left">Investigator</th>
                  <th className="px-2 py-2 text-left">Top Signal</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr
                    key={row.applicationId}
                    onClick={() => setSelectedId(row.applicationId)}
                    className={`cursor-pointer border-b border-slate-100 ${selected?.applicationId === row.applicationId ? 'bg-teal-50' : 'hover:bg-slate-50'}`}
                  >
                    <td className="px-2 py-2">{row.applicationId}</td>
                    <td className="px-2 py-2">{row.effectiveStatus}</td>
                    <td className="px-2 py-2">{new Date(row.closedAt).toLocaleString()}</td>
                    <td className="px-2 py-2">{row.investigator}</td>
                    <td className="px-2 py-2">{row.app.topSignal}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {selected && (
            <div className="rounded border border-slate-200 p-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Case Detail</p>
              <p className="mt-2 text-sm font-semibold text-slate-900">{selected.applicationId}</p>
              <p className="text-xs text-slate-600">Disposition: {selected.effectiveStatus}</p>
              <p className="text-xs text-slate-600">Investigator: {selected.investigator}</p>
              <p className="mt-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Signal Profile</p>
              <div className="max-h-28 space-y-1 overflow-auto text-xs">
                {selected.app.signalResults
                  .filter((signal) => signal.triggered)
                  .sort((a, b) => b.contribution - a.contribution)
                  .map((signal) => (
                    <p key={signal.signalId} className="rounded bg-slate-50 px-2 py-1">{signal.signalName} (+{signal.contribution})</p>
                  ))}
              </div>

              <p className="mt-3 text-xs font-semibold uppercase tracking-wide text-slate-500">Notes</p>
              <div className="max-h-28 space-y-1 overflow-auto text-xs">
                {notes.length === 0 && <p className="text-slate-500">No investigator notes on record.</p>}
                {notes.map((note) => (
                  <div key={note.id} className="rounded bg-slate-50 p-2">
                    <p className="font-semibold">{note.author}</p>
                    <p className="text-slate-500">{new Date(note.timestamp).toLocaleString()}</p>
                    <p>{note.text}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
