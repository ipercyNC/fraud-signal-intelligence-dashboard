import type { CaseStatus } from '../types';

const transitions: Record<CaseStatus, CaseStatus[]> = {
  New: ['In Review', 'Escalated', 'Cleared', 'Declined'],
  'In Review': ['Escalated', 'Cleared', 'Declined'],
  Escalated: ['Cleared', 'Declined'],
  Cleared: [],
  Declined: [],
};

export function canTransitionCaseStatus(from: CaseStatus, to: CaseStatus): boolean {
  return transitions[from].includes(to);
}

export function nextCaseStatuses(status: CaseStatus): CaseStatus[] {
  return transitions[status];
}
