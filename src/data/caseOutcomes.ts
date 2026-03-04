import { scoredApplications } from './scoredApplications';
import type { CaseOutcome, CaseStatus, ScoredApplication } from '../domain/types';

const investigators = ['A. Cruz', 'N. Patel', 'D. Carter', 'J. Kim', 'S. Walker'];

function hashCode(value: string): number {
  let hash = 0;
  for (let i = 0; i < value.length; i += 1) {
    hash = (hash << 5) - hash + value.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

function defaultDisposition(application: ScoredApplication): CaseStatus {
  const hasFraudPattern = application.patternTags.length > 0;
  if (application.riskScore >= 75 && hasFraudPattern) return 'Declined';
  if (application.riskScore >= 75) return 'Escalated';
  if (application.riskScore >= 40 && hasFraudPattern) return 'Escalated';
  if (application.riskScore < 30) return 'Cleared';
  return 'In Review';
}

export const caseOutcomes: CaseOutcome[] = scoredApplications.map((application) => {
  const hash = hashCode(application.id);
  const investigator = investigators[hash % investigators.length];
  const disposition = defaultDisposition(application);
  const hours = 2 + (hash % 96);
  const submittedAt = new Date(application.timestamps.submittedAt).getTime();

  return {
    applicationId: application.id,
    finalDisposition: disposition,
    investigator,
    closedAt: new Date(submittedAt + hours * 60 * 60 * 1000).toISOString(),
    timeToDispositionHours: hours,
  };
});

export const caseOutcomeById = new Map(caseOutcomes.map((outcome) => [outcome.applicationId, outcome]));
