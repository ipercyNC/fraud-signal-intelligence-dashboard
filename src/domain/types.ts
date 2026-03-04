export type SignalCategory =
  | 'Identity'
  | 'Velocity'
  | 'Behavioral'
  | 'Financial'
  | 'Agent';

export type CaseStatus = 'New' | 'In Review' | 'Escalated' | 'Cleared' | 'Declined';

export type RiskBand = 'Low' | 'Medium' | 'High';

export interface SignalResult {
  signalId: string;
  signalName: string;
  category: SignalCategory;
  triggered: boolean;
  weight: number;
  contribution: number;
  explanation: string;
}

export interface Note {
  id: string;
  author: string;
  timestamp: string;
  text: string;
}

export interface CaseOutcome {
  applicationId: string;
  finalDisposition: CaseStatus;
  investigator: string;
  closedAt: string;
  timeToDispositionHours: number;
}

export interface CaseRecord extends CaseOutcome {
  notes: Note[];
}

export interface AIBrief {
  applicationId: string;
  mode: 'demo' | 'live' | 'fallback';
  cached: boolean;
  limited: boolean;
  fallback: boolean;
  summaryBullets: string[];
  recommendedAction: string;
  generatedAt: string;
}

export interface RuleConfig {
  id: string;
  name: string;
  category: SignalCategory;
  weight: number;
  status: 'Active' | 'Inactive';
}

export interface RawApplication {
  id: string;
  carrier: string;
  product: 'Term Life' | 'Whole Life' | 'Universal Life';
  channel: 'Direct' | 'Agent Assisted' | 'Broker Portal';
  timestamps: {
    startedAt: string;
    submittedAt: string;
    completionDurationSec: number;
    restartCount: number;
  };
  applicant: {
    firstName: string;
    lastName: string;
    maskedName: string;
    dob: string;
    maskedSSN: string;
    phone: string;
    email: string;
    address: {
      line1: string;
      city: string;
      state: string;
      zip: string;
    };
    ipState: string;
  };
  deviceSession: {
    deviceFingerprint: string;
    userAgentFamily: string;
    pasteInKeyFields: boolean;
    questionnaireDurationSec: number;
    submittedLocalHour: number;
  };
  financial: {
    annualIncome: number;
    coverageAmount: number;
    existingPolicies: number;
    coverageIncomeRatio: number;
  };
  beneficiary: {
    name: string;
    relation: string;
    sameAddress: boolean;
    isImmediateFamily: boolean;
  };
  agent: {
    id: string;
    name: string;
    state: string;
  };
  patternTags: string[];
}

export interface Application {
  id: string;
  applicantMaskedName: string;
  submittedAt: string;
  product: RawApplication['product'];
  coverageAmount: number;
  state: string;
  agentId: string;
  status: CaseStatus;
  riskScore: number;
  topSignal: string;
  signalResults: SignalResult[];
  notes: Note[];
}

export interface ScoredApplication extends RawApplication {
  caseStatus: CaseStatus;
  signalResults: SignalResult[];
  categoryContribution: Record<SignalCategory, number>;
  riskScore: number;
  riskBand: RiskBand;
  topSignal: string;
}
