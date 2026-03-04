import { useMemo, useState } from 'react';
import { Bar, BarChart, ResponsiveContainer, XAxis, YAxis } from 'recharts';
import { canTransitionCaseStatus } from '../../domain/cases';
import { useAppStore } from '../store';
import type { CaseStatus, ScoredApplication } from '../../domain/types';

function actionTarget(action: 'Clear' | 'Refer to Underwriter' | 'Escalate to SIU' | 'Decline'): CaseStatus {
  if (action === 'Clear') return 'Cleared';
  if (action === 'Escalate to SIU') return 'Escalated';
  if (action === 'Decline') return 'Declined';
  return 'In Review';
}

function linkedEntities(applicationId: string, scoredApplications: ScoredApplication[]) {
  const scoredApplicationById = new Map(scoredApplications.map((app) => [app.id, app]));
  const selected = scoredApplicationById.get(applicationId);
  if (!selected) return [];

  return scoredApplications
    .filter((candidate) => candidate.id !== selected.id)
    .filter(
      (candidate) =>
        candidate.applicant.phone === selected.applicant.phone ||
        candidate.applicant.email === selected.applicant.email ||
        candidate.deviceSession.deviceFingerprint === selected.deviceSession.deviceFingerprint ||
        candidate.beneficiary.name === selected.beneficiary.name,
    )
    .slice(0, 12)
    .map((candidate) => ({
      id: candidate.id,
      phoneMatch: candidate.applicant.phone === selected.applicant.phone,
      emailMatch: candidate.applicant.email === selected.applicant.email,
      deviceMatch: candidate.deviceSession.deviceFingerprint === selected.deviceSession.deviceFingerprint,
      beneficiaryMatch: candidate.beneficiary.name === selected.beneficiary.name,
    }));
}

export function CaseDetailPanel() {
  const isCollapsed = useAppStore((state) => state.isDetailPanelCollapsed);
  const toggle = useAppStore((state) => state.toggleDetailPanel);
  const scoredApplications = useAppStore((state) => state.scoredApplications);
  const selectedApplicationId = useAppStore((state) => state.selectedApplicationId);
  const casesById = useAppStore((state) => state.casesById);
  const aiBriefById = useAppStore((state) => state.aiBriefById);
  const aiLoadingById = useAppStore((state) => state.aiLoadingById);
  const getAIBrief = useAppStore((state) => state.getAIBrief);
  const setCaseStatus = useAppStore((state) => state.setCaseStatus);
  const addNote = useAppStore((state) => state.addNote);

  const [draftNote, setDraftNote] = useState('');

  const selected = useMemo(
    () => scoredApplications.find((application) => application.id === selectedApplicationId),
    [scoredApplications, selectedApplicationId],
  );

  const status = selected ? (casesById[selected.id]?.finalDisposition ?? selected.caseStatus) : 'New';
  const notes = selected ? casesById[selected.id]?.notes ?? [] : [];
  const aiBrief = selected ? aiBriefById[selected.id] : undefined;
  const aiLoading = selected ? Boolean(aiLoadingById[selected.id]) : false;

  const composition = useMemo(() => {
    if (!selected) return [];

    return [
      { category: 'Identity', value: selected.categoryContribution.Identity },
      { category: 'Velocity', value: selected.categoryContribution.Velocity },
      { category: 'Behavioral', value: selected.categoryContribution.Behavioral },
      { category: 'Financial', value: selected.categoryContribution.Financial },
      { category: 'Agent', value: selected.categoryContribution.Agent },
    ];
  }, [selected]);

  const links = useMemo(() => linkedEntities(selectedApplicationId, scoredApplications), [scoredApplications, selectedApplicationId]);

  const actions: Array<'Clear' | 'Refer to Underwriter' | 'Escalate to SIU' | 'Decline'> = [
    'Clear',
    'Refer to Underwriter',
    'Escalate to SIU',
    'Decline',
  ];

  return (
    <aside className="h-full rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Case Detail</h3>
        <button
          type="button"
          onClick={toggle}
          className="rounded-md border border-slate-200 px-2 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50"
        >
          {isCollapsed ? 'Expand' : 'Collapse'}
        </button>
      </div>

      {!isCollapsed && selected && (
        <div className="space-y-4 text-sm text-slate-700">
          <section className="rounded-md bg-slate-50 p-3">
            <p className="text-xs uppercase tracking-wide text-slate-500">Application Summary</p>
            <p className="mt-1 font-semibold text-slate-900">{selected.applicant.maskedName} ({selected.id})</p>
            <p className="mt-1 text-xs">Status: <span className="font-semibold">{status}</span></p>
            <p className="text-xs">Channel: {selected.channel}</p>
            <p className="text-xs">Duration: {Math.round(selected.timestamps.completionDurationSec / 60)} min</p>
            <p className="text-xs">Coverage: ${selected.financial.coverageAmount.toLocaleString()}</p>
          </section>

          <section>
            <p className="mb-2 text-xs uppercase tracking-wide text-slate-500">Signal Breakdown</p>
            <div className="max-h-36 space-y-1 overflow-auto rounded-md border border-slate-200 p-2">
              {selected.signalResults
                .filter((result) => result.triggered)
                .sort((a, b) => b.contribution - a.contribution)
                .map((result) => (
                  <div key={result.signalId} className="rounded bg-slate-50 p-2">
                    <p className="text-xs font-semibold text-slate-800">{result.signalName} (+{result.contribution})</p>
                    <p className="text-[11px] text-slate-600">{result.explanation}</p>
                  </div>
                ))}
            </div>
          </section>

          <section>
            <p className="mb-2 text-xs uppercase tracking-wide text-slate-500">Risk Composition</p>
            <div className="h-32 rounded-md border border-slate-200 p-2">
              <ResponsiveContainer>
                <BarChart data={composition}>
                  <XAxis dataKey="category" hide />
                  <YAxis hide domain={[0, 30]} />
                  <Bar dataKey="value" fill="#0f766e" radius={2} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </section>

          <section>
            <p className="mb-2 text-xs uppercase tracking-wide text-slate-500">Application Timeline</p>
            <div className="rounded-md border border-slate-200 p-2 text-xs">
              <p>Start: {new Date(selected.timestamps.startedAt).toLocaleString()}</p>
              <p>Submit: {new Date(selected.timestamps.submittedAt).toLocaleString()}</p>
              <p>Pause/Resume Count: {selected.timestamps.restartCount}</p>
            </div>
          </section>

          <section>
            <p className="mb-2 text-xs uppercase tracking-wide text-slate-500">Linked Entities</p>
            <div className="max-h-32 space-y-1 overflow-auto rounded-md border border-slate-200 p-2 text-xs">
              {links.length === 0 && <p className="text-slate-500">No linked entities found.</p>}
              {links.map((link) => (
                <p key={link.id} className="rounded bg-slate-50 px-2 py-1">
                  {link.id}
                  {link.phoneMatch ? ' phone' : ''}
                  {link.emailMatch ? ' email' : ''}
                  {link.deviceMatch ? ' device' : ''}
                  {link.beneficiaryMatch ? ' beneficiary' : ''}
                </p>
              ))}
            </div>
          </section>

          <section>
            <p className="mb-2 text-xs uppercase tracking-wide text-slate-500">Investigation Notes</p>
            <textarea
              value={draftNote}
              onChange={(event) => setDraftNote(event.target.value)}
              className="h-20 w-full rounded border border-slate-200 p-2 text-xs"
              placeholder="Add investigation note"
            />
            <button
              type="button"
              onClick={() => {
                const note = draftNote.trim();
                if (!note) return;
                void addNote(selected.id, note);
                setDraftNote('');
              }}
              className="mt-2 rounded bg-teal-700 px-3 py-1 text-xs font-semibold text-white hover:bg-teal-800"
            >
              Add Note
            </button>
            <div className="mt-2 max-h-24 space-y-1 overflow-auto">
              {notes.map((note) => (
                <div key={note.id} className="rounded bg-slate-50 p-2 text-xs">
                  <p className="font-semibold">{note.author}</p>
                  <p className="text-slate-500">{new Date(note.timestamp).toLocaleString()}</p>
                  <p>{note.text}</p>
                </div>
              ))}
            </div>
          </section>

          <section>
            <p className="mb-2 text-xs uppercase tracking-wide text-slate-500">Disposition Actions</p>
            <div className="grid grid-cols-2 gap-2">
              {actions.map((action) => {
                const target = actionTarget(action);
                const allowed = canTransitionCaseStatus(status, target);
                return (
                  <button
                    key={action}
                    type="button"
                    disabled={!allowed}
                    onClick={() => void setCaseStatus(selected.id, target)}
                    className="rounded border border-slate-200 px-2 py-1 text-xs font-medium text-slate-700 enabled:hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    {action}
                  </button>
                );
              })}
            </div>
          </section>

          <section>
            <div className="mb-2 flex items-center justify-between">
              <p className="text-xs uppercase tracking-wide text-slate-500">AI Assist Brief</p>
              <div className="flex gap-2">
                <button
                  type="button"
                  disabled={aiLoading}
                  onClick={() => void getAIBrief(selected.id, false)}
                  className="rounded border border-slate-200 px-2 py-1 text-xs font-medium text-slate-700 enabled:hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {aiLoading ? 'Generating...' : 'Generate AI Brief'}
                </button>
                <button
                  type="button"
                  disabled={aiLoading}
                  onClick={() => void getAIBrief(selected.id, true)}
                  className="rounded border border-slate-200 px-2 py-1 text-xs font-medium text-slate-700 enabled:hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Refresh
                </button>
              </div>
            </div>
            <div className="rounded border border-slate-200 p-2 text-xs">
              {!aiBrief && <p className="text-slate-500">Run AI brief to generate a concise investigation summary.</p>}
              {aiBrief && (
                <>
                  <ul className="space-y-1 text-slate-700">
                    {aiBrief.summaryBullets.map((bullet, index) => (
                      <li key={`${selected.id}-ai-${index}`}>- {bullet}</li>
                    ))}
                  </ul>
                  <p className="mt-2 font-semibold text-slate-800">Recommended Action: {aiBrief.recommendedAction}</p>
                  <p className="mt-1 text-slate-500">
                    Mode: {aiBrief.mode}
                    {aiBrief.cached ? ' · cached' : ''}
                    {aiBrief.limited ? ' · budget-limited fallback' : ''}
                    {' · '}
                    {new Date(aiBrief.generatedAt).toLocaleString()}
                  </p>
                </>
              )}
            </div>
          </section>
        </div>
      )}
    </aside>
  );
}
