import { useEffect, useMemo, useState } from 'react';
import { useAppStore } from '../../app/store';
import { evaluateSignals, buildSignalContext } from '../../domain/signals';
import type { RawApplication, RuleConfig, SignalCategory } from '../../domain/types';

type RuleStatus = 'Active' | 'Inactive';

type RuleRecord = RuleConfig & {
  description: string;
  triggerField: string;
  triggerOperator: '==' | '!=' | '>' | '>=' | '<' | '<=' | 'contains';
  triggerValue: string;
  logicJoin: 'AND' | 'OR';
  lookbackDays: 7 | 30 | 90;
  suppressionLogic: string;
};

const categoryDescriptions: Record<SignalCategory, string> = {
  Identity: 'Detects identity inconsistencies and synthetic profile indicators.',
  Velocity: 'Detects repeated activity across identities, channels, and entities.',
  Behavioral: 'Detects suspicious session and input behavior patterns.',
  Financial: 'Detects economic profile anomalies against expected underwriting norms.',
  Agent: 'Detects abusive or conflicted submission behavior by agents.',
};

function hydrateRules(baseRules: RuleConfig[]): RuleRecord[] {
  return baseRules.map((rule) => ({
    ...rule,
    description: categoryDescriptions[rule.category],
    triggerField: 'patternTags',
    triggerOperator: 'contains',
    triggerValue: rule.category.toLowerCase(),
    logicJoin: 'AND',
    lookbackDays: 30,
    suppressionLogic: 'None',
  }));
}

function countRecentTriggers(ruleId: string, lookbackDays: number): number {
  const cutoff = Date.now() - lookbackDays * 24 * 60 * 60 * 1000;
  const scoredApplications = useAppStore.getState().scoredApplications;
  return scoredApplications.filter((application) => {
    const submittedAt = new Date(application.timestamps.submittedAt).getTime();
    if (Number.isNaN(submittedAt) || submittedAt < cutoff) return false;
    return application.signalResults.some((result) => result.signalId === ruleId && result.triggered);
  }).length;
}

function computeRulePrecision(ruleId: string): { precision: number; positives: number } {
  const scoredApplications = useAppStore.getState().scoredApplications;
  const closedCases = scoredApplications.filter(
    (application) =>
      Date.now() - new Date(application.timestamps.submittedAt).getTime() > 14 * 24 * 60 * 60 * 1000,
  );

  const firedApps = closedCases.filter((application) =>
    application.signalResults.some((result) => result.signalId === ruleId && result.triggered),
  );

  if (firedApps.length === 0) return { precision: 0, positives: 0 };

  const truePositives = firedApps.filter((application) => application.patternTags.length > 0).length;
  return {
    precision: Number(((truePositives / firedApps.length) * 100).toFixed(1)),
    positives: firedApps.length,
  };
}

function toSampleApplication(input: unknown): RawApplication | null {
  if (!input || typeof input !== 'object') return null;

  const candidate = input as Record<string, unknown>;
  if (typeof candidate.applicationId === 'string') {
    const scoredApplications = useAppStore.getState().scoredApplications;
    const matched = scoredApplications.find((app) => app.id === candidate.applicationId);
    return matched ?? null;
  }

  if (
    typeof candidate.id === 'string' &&
    typeof candidate.applicant === 'object' &&
    candidate.applicant !== null &&
    typeof candidate.deviceSession === 'object' &&
    candidate.deviceSession !== null &&
    typeof candidate.financial === 'object' &&
    candidate.financial !== null &&
    typeof candidate.beneficiary === 'object' &&
    candidate.beneficiary !== null &&
    typeof candidate.agent === 'object' &&
    candidate.agent !== null &&
    typeof candidate.timestamps === 'object' &&
    candidate.timestamps !== null
  ) {
    return candidate as unknown as RawApplication;
  }

  return null;
}

export function SignalLibraryView() {
  const sourceRules = useAppStore((state) => state.rules);
  const scoredApplications = useAppStore((state) => state.scoredApplications);

  const [rules, setRules] = useState<RuleRecord[]>([]);
  const [activeRuleId, setActiveRuleId] = useState<string>('');
  const [sampleJson, setSampleJson] = useState<string>(`{
  "applicationId": "APP-0001"
}`);
  const [testResult, setTestResult] = useState<string>('Run a test to see fired/not fired explanation.');

  useEffect(() => {
    const hydrated = hydrateRules(sourceRules);
    setRules(hydrated);
    if (!hydrated.some((rule) => rule.id === activeRuleId)) {
      setActiveRuleId(hydrated[0]?.id ?? '');
    }
  }, [activeRuleId, sourceRules]);

  const activeRule = useMemo(() => rules.find((rule) => rule.id === activeRuleId), [activeRuleId, rules]);

  const signalContext = useMemo(
    () => buildSignalContext(scoredApplications as unknown as RawApplication[]),
    [scoredApplications],
  );

  const updateRule = (patch: Partial<RuleRecord>) => {
    if (!activeRule) return;
    setRules((current) =>
      current.map((rule) => (rule.id === activeRule.id ? { ...rule, ...patch } : rule)),
    );
  };

  const runRuleTest = () => {
    if (!activeRule) return;
    try {
      const parsed = JSON.parse(sampleJson) as unknown;
      const sampleApp = toSampleApplication(parsed);
      if (!sampleApp) {
        setTestResult('Input did not match expected sample format. Use {"applicationId":"APP-0001"} or full RawApplication JSON.');
        return;
      }

      const evaluated = evaluateSignals(sampleApp, signalContext, rules);
      const signal = evaluated.find((result) => result.signalId === activeRule.id);
      if (!signal) {
        setTestResult(`Rule ${activeRule.id} not found in evaluator output.`);
        return;
      }

      setTestResult(
        `${signal.triggered ? 'FIRED' : 'NOT FIRED'}: ${signal.explanation} (weight ${signal.weight}, contribution ${signal.contribution})`,
      );
    } catch (error) {
      setTestResult(`Invalid JSON: ${(error as Error).message}`);
    }
  };

  return (
    <section className="h-full rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-lg font-semibold text-slate-900">Signal Library</h2>
        <p className="text-xs uppercase tracking-wide text-slate-500">{rules.length} Rules</p>
      </div>

      {!activeRule && (
        <div className="rounded border border-slate-200 bg-slate-50 p-3 text-sm text-slate-600">
          No rules available.
        </div>
      )}

      {activeRule && <div className="grid gap-4 lg:grid-cols-[1.2fr_1fr]">
        <div className="space-y-3">
          {rules.map((rule) => {
            const recentTriggers = countRecentTriggers(rule.id, 30);
            const perf = computeRulePrecision(rule.id);
            const isActive = rule.id === activeRule.id;

            return (
              <button
                key={rule.id}
                type="button"
                onClick={() => setActiveRuleId(rule.id)}
                className={`w-full rounded-lg border p-3 text-left transition ${
                  isActive ? 'border-teal-600 bg-teal-50' : 'border-slate-200 hover:bg-slate-50'
                }`}
              >
                <div className="flex items-center justify-between">
                  <p className="text-sm font-semibold text-slate-900">{rule.name}</p>
                  <span
                    className={`rounded px-2 py-0.5 text-xs font-semibold ${
                      rule.status === 'Active' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-600'
                    }`}
                  >
                    {rule.status}
                  </span>
                </div>
                <p className="mt-1 text-xs text-slate-600">{rule.category} · Weight {rule.weight}</p>
                <p className="mt-1 text-xs text-slate-500">{rule.description}</p>
                <div className="mt-2 flex gap-2 text-xs text-slate-600">
                  <span className="rounded bg-slate-100 px-2 py-0.5">30d Triggers: {recentTriggers}</span>
                  <span className="rounded bg-slate-100 px-2 py-0.5">Precision: {perf.precision}%</span>
                </div>
              </button>
            );
          })}
        </div>

        <div className="space-y-4 rounded-lg border border-slate-200 p-4">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Rule Editor</h3>

          <label className="block text-xs text-slate-500">
            Name
            <input
              value={activeRule.name}
              onChange={(event) => updateRule({ name: event.target.value })}
              className="mt-1 w-full rounded border border-slate-200 px-2 py-1 text-sm text-slate-700"
            />
          </label>

          <label className="block text-xs text-slate-500">
            Description
            <textarea
              value={activeRule.description}
              onChange={(event) => updateRule({ description: event.target.value })}
              className="mt-1 h-16 w-full rounded border border-slate-200 px-2 py-1 text-sm text-slate-700"
            />
          </label>

          <div className="grid grid-cols-2 gap-2">
            <label className="text-xs text-slate-500">
              Weight (1-25)
              <input
                type="range"
                min={1}
                max={25}
                value={activeRule.weight}
                onChange={(event) => updateRule({ weight: Number(event.target.value) })}
                className="mt-1 w-full"
              />
              <span className="text-[11px] text-slate-600">Current: {activeRule.weight}</span>
            </label>

            <label className="text-xs text-slate-500">
              Status
              <select
                value={activeRule.status}
                onChange={(event) => updateRule({ status: event.target.value as RuleStatus })}
                className="mt-1 w-full rounded border border-slate-200 px-2 py-1 text-sm text-slate-700"
              >
                <option value="Active">Active</option>
                <option value="Inactive">Inactive</option>
              </select>
            </label>
          </div>

          <div className="rounded border border-slate-200 p-3">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Trigger Logic Builder</p>
            <div className="grid grid-cols-3 gap-2">
              <input
                value={activeRule.triggerField}
                onChange={(event) => updateRule({ triggerField: event.target.value })}
                className="rounded border border-slate-200 px-2 py-1 text-xs"
                placeholder="field"
              />
              <select
                value={activeRule.triggerOperator}
                onChange={(event) =>
                  updateRule({
                    triggerOperator: event.target.value as RuleRecord['triggerOperator'],
                  })
                }
                className="rounded border border-slate-200 px-2 py-1 text-xs"
              >
                <option value="==">==</option>
                <option value="!=">!=</option>
                <option value=">">&gt;</option>
                <option value=">=">&gt;=</option>
                <option value="<">&lt;</option>
                <option value="<=">&lt;=</option>
                <option value="contains">contains</option>
              </select>
              <input
                value={activeRule.triggerValue}
                onChange={(event) => updateRule({ triggerValue: event.target.value })}
                className="rounded border border-slate-200 px-2 py-1 text-xs"
                placeholder="value"
              />
            </div>

            <div className="mt-2 grid grid-cols-2 gap-2">
              <label className="text-xs text-slate-500">
                Logic Join
                <select
                  value={activeRule.logicJoin}
                  onChange={(event) => updateRule({ logicJoin: event.target.value as 'AND' | 'OR' })}
                  className="mt-1 w-full rounded border border-slate-200 px-2 py-1 text-xs"
                >
                  <option value="AND">AND</option>
                  <option value="OR">OR</option>
                </select>
              </label>

              <label className="text-xs text-slate-500">
                Lookback Window
                <select
                  value={activeRule.lookbackDays}
                  onChange={(event) => updateRule({ lookbackDays: Number(event.target.value) as 7 | 30 | 90 })}
                  className="mt-1 w-full rounded border border-slate-200 px-2 py-1 text-xs"
                >
                  <option value={7}>7 days</option>
                  <option value={30}>30 days</option>
                  <option value={90}>90 days</option>
                </select>
              </label>
            </div>

            <label className="mt-2 block text-xs text-slate-500">
              Suppression Logic
              <input
                value={activeRule.suppressionLogic}
                onChange={(event) => updateRule({ suppressionLogic: event.target.value })}
                className="mt-1 w-full rounded border border-slate-200 px-2 py-1 text-xs"
                placeholder="e.g., suppress if cleared in prior 14d"
              />
            </label>
          </div>

          <div className="rounded border border-slate-200 p-3">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Rule Test Harness</p>
            <textarea
              value={sampleJson}
              onChange={(event) => setSampleJson(event.target.value)}
              className="h-24 w-full rounded border border-slate-200 p-2 font-mono text-xs"
            />
            <button
              type="button"
              onClick={runRuleTest}
              className="mt-2 rounded bg-teal-700 px-3 py-1 text-xs font-semibold text-white hover:bg-teal-800"
            >
              Run Test
            </button>
            <p className="mt-2 rounded bg-slate-50 p-2 text-xs text-slate-700">{testResult}</p>
          </div>

          <div className="rounded border border-slate-200 p-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Signal Performance</p>
            {(() => {
              const perf = computeRulePrecision(activeRule.id);
              return (
                <div className="mt-2 text-xs text-slate-700">
                  <p>Precision on historical closed outcomes: {perf.precision}%</p>
                  <p>Fired positives evaluated: {perf.positives}</p>
                </div>
              );
            })()}
          </div>
        </div>
      </div>}
    </section>
  );
}
