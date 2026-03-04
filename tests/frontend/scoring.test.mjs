import test from 'node:test';
import assert from 'node:assert/strict';

import { scoreApplications } from '../../.tmp-frontend-tests/scoreApplication.js';

function makeApplication(id, overrides = {}) {
  const base = {
    id,
    carrier: 'NorthRiver',
    product: 'Term Life',
    channel: 'Direct',
    timestamps: {
      startedAt: '2026-03-01T10:00:00.000Z',
      submittedAt: '2026-03-01T10:05:00.000Z',
      completionDurationSec: 120,
      restartCount: 0,
    },
    applicant: {
      firstName: 'Alex',
      lastName: 'Smith',
      maskedName: 'A*** S***',
      dob: '1988-01-01',
      maskedSSN: '***-**-1111',
      phone: '+1-555-200-1000',
      email: 'alex.smith@mail.test',
      address: {
        line1: '100 Oak St',
        city: 'Sample City',
        state: 'CA',
        zip: '94105',
      },
      ipState: 'CA',
    },
    deviceSession: {
      deviceFingerprint: 'dfp-123456',
      userAgentFamily: 'Chrome',
      pasteInKeyFields: false,
      questionnaireDurationSec: 120,
      submittedLocalHour: 12,
    },
    financial: {
      annualIncome: 100000,
      coverageAmount: 200000,
      existingPolicies: 1,
      coverageIncomeRatio: 2,
    },
    beneficiary: {
      name: 'Pat Smith',
      relation: 'Spouse',
      sameAddress: true,
      isImmediateFamily: true,
    },
    agent: {
      id: 'AGT-0001',
      name: 'Jordan Lee',
      state: 'CA',
    },
    patternTags: [],
  };

  return {
    ...base,
    ...overrides,
  };
}

test('clean application remains low risk', () => {
  const scored = scoreApplications([makeApplication('APP-TEST-1')]);
  assert.equal(scored[0].riskBand, 'Low');
  assert.equal(scored[0].riskScore < 40, true);
});

test('high-signal application respects category caps', () => {
  const heavy = makeApplication('APP-TEST-2', {
    timestamps: {
      startedAt: '2026-03-01T10:00:00.000Z',
      submittedAt: '2026-03-01T10:01:00.000Z',
      completionDurationSec: 60,
      restartCount: 4,
    },
    applicant: {
      ...makeApplication('TMP').applicant,
      ipState: 'TX',
    },
    deviceSession: {
      ...makeApplication('TMP').deviceSession,
      pasteInKeyFields: true,
      questionnaireDurationSec: 30,
      submittedLocalHour: 2,
    },
    financial: {
      annualIncome: 40000,
      coverageAmount: 2000000,
      existingPolicies: 0,
      coverageIncomeRatio: 50,
    },
    beneficiary: {
      name: 'Jordan Lee',
      relation: 'Trust',
      sameAddress: false,
      isImmediateFamily: false,
    },
    patternTags: ['velocity-ring', 'agent-anomaly', 'agent-beneficiary-conflict', 'ssn-age-mismatch'],
  });

  const scored = scoreApplications([heavy, makeApplication('APP-TEST-3')]);
  assert.equal(scored[0].riskScore <= 100, true);
  assert.equal(scored[0].categoryContribution.Identity <= 30, true);
  assert.equal(scored[0].categoryContribution.Velocity <= 30, true);
  assert.equal(scored[0].riskBand, 'High');
});
