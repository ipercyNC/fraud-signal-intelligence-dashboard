import type {
  RawApplication,
  RiskBand,
  RuleConfig,
  ScoredApplication,
  SignalCategory,
  SignalResult,
} from '../types';
import { buildSignalContext, evaluateSignals } from '../signals/evaluators';

const CATEGORY_CAPS: Record<SignalCategory, number> = {
  Identity: 30,
  Velocity: 30,
  Behavioral: 15,
  Financial: 15,
  Agent: 20,
};

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function getRiskBand(score: number): RiskBand {
  if (score >= 75) return 'High';
  if (score >= 40) return 'Medium';
  return 'Low';
}

function categoryTotals(signalResults: SignalResult[]): Record<SignalCategory, number> {
  const totals: Record<SignalCategory, number> = {
    Identity: 0,
    Velocity: 0,
    Behavioral: 0,
    Financial: 0,
    Agent: 0,
  };

  for (const signal of signalResults) {
    if (!signal.triggered) continue;
    totals[signal.category] += signal.contribution;
  }

  return totals;
}

function applyCategoryCaps(totals: Record<SignalCategory, number>): Record<SignalCategory, number> {
  return {
    Identity: clamp(totals.Identity, 0, CATEGORY_CAPS.Identity),
    Velocity: clamp(totals.Velocity, 0, CATEGORY_CAPS.Velocity),
    Behavioral: clamp(totals.Behavioral, 0, CATEGORY_CAPS.Behavioral),
    Financial: clamp(totals.Financial, 0, CATEGORY_CAPS.Financial),
    Agent: clamp(totals.Agent, 0, CATEGORY_CAPS.Agent),
  };
}

function topSignal(signalResults: SignalResult[]): string {
  const triggered = signalResults.filter((signal) => signal.triggered);
  if (triggered.length === 0) return 'No material signals';
  return triggered.sort((a, b) => b.contribution - a.contribution)[0].signalName;
}

export function scoreSingleApplication(
  application: RawApplication,
  allApplications: RawApplication[],
  rules?: RuleConfig[],
): ScoredApplication {
  const context = buildSignalContext(allApplications);
  const signalResults = evaluateSignals(application, context, rules);
  const rawCategoryTotals = categoryTotals(signalResults);
  const categoryContribution = applyCategoryCaps(rawCategoryTotals);
  const score = clamp(
    Object.values(categoryContribution).reduce((sum, value) => sum + value, 0),
    0,
    100,
  );

  return {
    ...application,
    caseStatus: 'New',
    signalResults,
    categoryContribution,
    riskScore: score,
    riskBand: getRiskBand(score),
    topSignal: topSignal(signalResults),
  };
}

export function scoreApplications(
  applications: RawApplication[],
  rules?: RuleConfig[],
): ScoredApplication[] {
  const context = buildSignalContext(applications);

  return applications.map((application) => {
    const signalResults = evaluateSignals(application, context, rules);
    const rawCategoryTotals = categoryTotals(signalResults);
    const categoryContribution = applyCategoryCaps(rawCategoryTotals);
    const score = clamp(
      Object.values(categoryContribution).reduce((sum, value) => sum + value, 0),
      0,
      100,
    );

    return {
      ...application,
      caseStatus: 'New',
      signalResults,
      categoryContribution,
      riskScore: score,
      riskBand: getRiskBand(score),
      topSignal: topSignal(signalResults),
    };
  });
}
