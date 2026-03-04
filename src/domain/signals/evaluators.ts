import type { RawApplication, RuleConfig, SignalCategory, SignalResult } from '../types';

export interface SignalContext {
  phoneCounts30d: Map<string, number>;
  emailCounts90d: Map<string, number>;
  deviceCounts90d: Map<string, number>;
  agentCounts30d: Map<string, number>;
}

function defaultWeightById(signalId: string): number {
  const weights: Record<string, number> = {
    SIG_ID_01: 12,
    SIG_ID_02: 10,
    SIG_ID_03: 14,
    SIG_ID_04: 9,
    SIG_VEL_01: 18,
    SIG_VEL_02: 15,
    SIG_VEL_03: 17,
    SIG_VEL_04: 16,
    SIG_BEH_01: 8,
    SIG_BEH_02: 9,
    SIG_BEH_03: 7,
    SIG_BEH_04: 6,
    SIG_FIN_01: 13,
    SIG_FIN_02: 14,
    SIG_FIN_03: 11,
    SIG_AG_01: 12,
    SIG_AG_02: 20,
    SIG_AG_03: 10,
  };

  return weights[signalId] ?? 8;
}

function lookupWeight(signalId: string, rules?: RuleConfig[]): number {
  const fromRule = rules?.find((rule) => rule.id === signalId)?.weight;
  return fromRule ?? defaultWeightById(signalId);
}

function buildSignalResult(
  signalId: string,
  signalName: string,
  category: SignalCategory,
  triggered: boolean,
  explanation: string,
  rules?: RuleConfig[],
): SignalResult {
  const weight = lookupWeight(signalId, rules);

  return {
    signalId,
    signalName,
    category,
    triggered,
    weight,
    contribution: triggered ? weight : 0,
    explanation,
  };
}

export function buildSignalContext(applications: RawApplication[]): SignalContext {
  const phoneCounts30d = new Map<string, number>();
  const emailCounts90d = new Map<string, number>();
  const deviceCounts90d = new Map<string, number>();
  const agentCounts30d = new Map<string, number>();

  for (const app of applications) {
    phoneCounts30d.set(app.applicant.phone, (phoneCounts30d.get(app.applicant.phone) ?? 0) + 1);
    emailCounts90d.set(app.applicant.email, (emailCounts90d.get(app.applicant.email) ?? 0) + 1);
    deviceCounts90d.set(
      app.deviceSession.deviceFingerprint,
      (deviceCounts90d.get(app.deviceSession.deviceFingerprint) ?? 0) + 1,
    );
    agentCounts30d.set(app.agent.id, (agentCounts30d.get(app.agent.id) ?? 0) + 1);
  }

  return { phoneCounts30d, emailCounts90d, deviceCounts90d, agentCounts30d };
}

export function evaluateSignals(
  application: RawApplication,
  context: SignalContext,
  rules?: RuleConfig[],
): SignalResult[] {
  const { applicant, deviceSession, financial, beneficiary, agent, patternTags } = application;
  const signals: SignalResult[] = [];

  const hasTag = (tag: string) => patternTags.includes(tag);
  const phoneCount = context.phoneCounts30d.get(applicant.phone) ?? 1;
  const emailCount = context.emailCounts90d.get(applicant.email) ?? 1;
  const deviceCount = context.deviceCounts90d.get(deviceSession.deviceFingerprint) ?? 1;
  const agentCount = context.agentCounts30d.get(agent.id) ?? 1;

  signals.push(
    buildSignalResult(
      'SIG_ID_01',
      'Address mismatch',
      'Identity',
      applicant.address.state !== applicant.ipState,
      `Address state ${applicant.address.state} vs IP state ${applicant.ipState}.`,
      rules,
    ),
  );

  signals.push(
    buildSignalResult(
      'SIG_ID_02',
      'IP geolocation mismatch',
      'Identity',
      applicant.address.state !== applicant.ipState,
      'IP region conflicts with declared residence.',
      rules,
    ),
  );

  signals.push(
    buildSignalResult(
      'SIG_ID_03',
      'SSN age mismatch',
      'Identity',
      hasTag('ssn-age-mismatch'),
      'SSN issuance-age heuristic indicates inconsistency.',
      rules,
    ),
  );

  signals.push(
    buildSignalResult(
      'SIG_ID_04',
      'Thin credit file',
      'Identity',
      hasTag('thin-credit-file') || (financial.existingPolicies === 0 && financial.annualIncome < 50000),
      'Limited policy/credit depth relative to application profile.',
      rules,
    ),
  );

  signals.push(
    buildSignalResult(
      'SIG_VEL_01',
      'Multi-application in 30 days',
      'Velocity',
      hasTag('velocity-ring') || phoneCount >= 3,
      `Phone appears in ${phoneCount} applications in lookback window.`,
      rules,
    ),
  );

  signals.push(
    buildSignalResult(
      'SIG_VEL_02',
      'Shared phone/email in 90 days',
      'Velocity',
      phoneCount >= 2 || emailCount >= 2,
      `Phone count ${phoneCount}, email count ${emailCount}.`,
      rules,
    ),
  );

  signals.push(
    buildSignalResult(
      'SIG_VEL_03',
      'Device fingerprint reuse across identities',
      'Velocity',
      hasTag('velocity-ring') || deviceCount >= 3,
      `Device fingerprint observed ${deviceCount} times.`,
      rules,
    ),
  );

  signals.push(
    buildSignalResult(
      'SIG_VEL_04',
      'Agent velocity spike',
      'Velocity',
      hasTag('agent-anomaly') || agentCount >= 12,
      `Agent ${agent.id} has ${agentCount} submissions in window.`,
      rules,
    ),
  );

  signals.push(
    buildSignalResult(
      'SIG_BEH_01',
      'Health questionnaire completed under 90 seconds',
      'Behavioral',
      deviceSession.questionnaireDurationSec < 90,
      `Questionnaire duration ${deviceSession.questionnaireDurationSec}s.`,
      rules,
    ),
  );

  signals.push(
    buildSignalResult(
      'SIG_BEH_02',
      'Paste behavior in key fields',
      'Behavioral',
      deviceSession.pasteInKeyFields,
      'Key fields were pasted instead of typed.',
      rules,
    ),
  );

  signals.push(
    buildSignalResult(
      'SIG_BEH_03',
      'Session restart anomaly',
      'Behavioral',
      application.timestamps.restartCount >= 2,
      `Restart count ${application.timestamps.restartCount}.`,
      rules,
    ),
  );

  signals.push(
    buildSignalResult(
      'SIG_BEH_04',
      'Off-hours submission (1am-4am local)',
      'Behavioral',
      deviceSession.submittedLocalHour >= 1 && deviceSession.submittedLocalHour <= 4,
      `Submitted at local hour ${deviceSession.submittedLocalHour}.`,
      rules,
    ),
  );

  signals.push(
    buildSignalResult(
      'SIG_FIN_01',
      'Coverage-to-income anomaly',
      'Financial',
      financial.coverageIncomeRatio >= 15,
      `Coverage/income ratio ${financial.coverageIncomeRatio}.`,
      rules,
    ),
  );

  signals.push(
    buildSignalResult(
      'SIG_FIN_02',
      'High-value first policy',
      'Financial',
      financial.existingPolicies === 0 && financial.coverageAmount >= 1000000,
      `Coverage ${financial.coverageAmount} with ${financial.existingPolicies} prior policies.`,
      rules,
    ),
  );

  signals.push(
    buildSignalResult(
      'SIG_FIN_03',
      'Beneficiary not immediate family',
      'Financial',
      !beneficiary.isImmediateFamily,
      `Beneficiary relation is ${beneficiary.relation}.`,
      rules,
    ),
  );

  signals.push(
    buildSignalResult(
      'SIG_AG_01',
      'Agent prior flagged history',
      'Agent',
      hasTag('agent-anomaly') || agentCount >= 12,
      `Agent ${agent.id} exceeds baseline flagged velocity threshold.`,
      rules,
    ),
  );

  signals.push(
    buildSignalResult(
      'SIG_AG_02',
      'Agent listed as beneficiary',
      'Agent',
      hasTag('agent-beneficiary-conflict') || beneficiary.name === agent.name,
      'Agent identity overlaps with beneficiary record.',
      rules,
    ),
  );

  signals.push(
    buildSignalResult(
      'SIG_AG_03',
      'Rapid agent submission after open',
      'Agent',
      hasTag('agent-anomaly') || application.timestamps.completionDurationSec < 180,
      `Completion duration ${application.timestamps.completionDurationSec}s.`,
      rules,
    ),
  );

  return signals;
}
