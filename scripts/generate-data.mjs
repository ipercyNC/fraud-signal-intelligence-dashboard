import { writeFileSync } from 'node:fs';
import { join } from 'node:path';

const SEED = 20260303;
const APP_COUNT = 240;
const AGENT_COUNT = 24;
const BASE_TIMESTAMP_MS = Date.UTC(2026, 2, 3, 12, 0, 0);

const states = ['CA', 'TX', 'FL', 'NY', 'GA', 'NC', 'IL', 'AZ', 'WA', 'CO', 'PA', 'OH'];
const products = ['Term Life', 'Whole Life', 'Universal Life'];
const channels = ['Direct', 'Agent Assisted', 'Broker Portal'];
const carriers = ['NorthRiver', 'HarborLife', 'SummitMutual', 'CanopyAssure'];
const firstNames = ['Alex', 'Jordan', 'Taylor', 'Morgan', 'Casey', 'Riley', 'Quinn', 'Hayden', 'Parker', 'Avery', 'Rowan', 'Kendall'];
const lastNames = ['Smith', 'Johnson', 'Brown', 'Davis', 'Clark', 'Wilson', 'Martinez', 'Lee', 'Walker', 'Hall', 'Young', 'King'];
const beneficiaryRelations = ['Spouse', 'Child', 'Parent', 'Sibling', 'Business Partner', 'Trust', 'Friend'];

const ruleCatalog = [
  ['SIG_ID_01', 'Address mismatch', 'Identity', 12],
  ['SIG_ID_02', 'IP geolocation mismatch', 'Identity', 10],
  ['SIG_ID_03', 'SSN age mismatch', 'Identity', 14],
  ['SIG_ID_04', 'Thin credit file', 'Identity', 9],
  ['SIG_VEL_01', 'Multi-application in 30 days', 'Velocity', 18],
  ['SIG_VEL_02', 'Shared phone/email in 90 days', 'Velocity', 15],
  ['SIG_VEL_03', 'Device fingerprint reuse', 'Velocity', 17],
  ['SIG_VEL_04', 'Agent velocity spike', 'Velocity', 16],
  ['SIG_BEH_01', 'Questionnaire under 90 seconds', 'Behavioral', 8],
  ['SIG_BEH_02', 'Paste behavior in key fields', 'Behavioral', 9],
  ['SIG_BEH_03', 'Session restart anomaly', 'Behavioral', 7],
  ['SIG_BEH_04', 'Off-hours submission', 'Behavioral', 6],
  ['SIG_FIN_01', 'Coverage-to-income anomaly', 'Financial', 13],
  ['SIG_FIN_02', 'High-value first policy', 'Financial', 14],
  ['SIG_FIN_03', 'Beneficiary not immediate family', 'Financial', 11],
  ['SIG_AG_01', 'Agent prior flagged history', 'Agent', 12],
  ['SIG_AG_02', 'Agent listed as beneficiary', 'Agent', 20],
  ['SIG_AG_03', 'Rapid agent submission after open', 'Agent', 10],
].map(([id, name, category, defaultWeight]) => ({
  id,
  name,
  category,
  weight: defaultWeight,
  defaultWeight,
  status: 'Active',
}));

function mulberry32(seed) {
  let t = seed >>> 0;
  return () => {
    t += 0x6d2b79f5;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

const rng = mulberry32(SEED);

function pick(arr) {
  return arr[Math.floor(rng() * arr.length)];
}

function int(min, max) {
  return Math.floor(rng() * (max - min + 1)) + min;
}

function float(min, max, digits = 2) {
  const value = min + rng() * (max - min);
  return Number(value.toFixed(digits));
}

function id(prefix, i) {
  return `${prefix}-${String(i).padStart(4, '0')}`;
}

function makeMaskedSsn(i) {
  const tail = String(1000 + ((i * 37) % 9000));
  return `***-**-${tail}`;
}

function randomDateInLast(days) {
  const offsetMs = int(0, days * 24 * 60 * 60) * 1000;
  return new Date(BASE_TIMESTAMP_MS - offsetMs).toISOString();
}

function makeAgents() {
  const agents = [];
  for (let i = 1; i <= AGENT_COUNT; i += 1) {
    const first = pick(firstNames);
    const last = pick(lastNames);
    agents.push({
      id: id('AGT', i),
      name: `${first} ${last}`,
      state: pick(states),
      yearsActive: int(1, 24),
      submissions30d: int(8, 60),
      flaggedRate90d: float(0.01, 0.22, 3),
      priorEscalations: int(0, 10),
    });
  }

  // Deliberate rogue agent pattern for demo.
  agents[0].submissions30d = 136;
  agents[0].flaggedRate90d = 0.41;
  agents[0].priorEscalations = 24;

  return agents;
}

function makeBaseApplication(i, agents) {
  const first = pick(firstNames);
  const last = pick(lastNames);
  const state = pick(states);
  const startedAt = randomDateInLast(45);
  const submitLagMin = int(2, 90);
  const submittedAt = new Date(new Date(startedAt).getTime() + submitLagMin * 60000).toISOString();
  const income = int(38000, 220000);
  const coverage = int(100000, 2000000);
  const agent = pick(agents);
  const relation = pick(beneficiaryRelations);

  return {
    id: id('APP', i),
    carrier: pick(carriers),
    product: pick(products),
    channel: pick(channels),
    timestamps: {
      startedAt,
      submittedAt,
      completionDurationSec: submitLagMin * 60,
      restartCount: int(0, 3),
    },
    applicant: {
      firstName: first,
      lastName: last,
      maskedName: `${first[0]}*** ${last[0]}***`,
      dob: `${int(1960, 2003)}-${String(int(1, 12)).padStart(2, '0')}-${String(int(1, 28)).padStart(2, '0')}`,
      maskedSSN: makeMaskedSsn(i),
      phone: `+1-555-${String(int(200, 999))}-${String(int(1000, 9999))}`,
      email: `${first.toLowerCase()}.${last.toLowerCase()}${int(1, 999)}@mail.test`,
      address: {
        line1: `${int(100, 9999)} Oak St`,
        city: 'Sample City',
        state,
        zip: String(int(10000, 99999)),
      },
      ipState: state,
    },
    deviceSession: {
      deviceFingerprint: `dfp-${int(100000, 999999)}`,
      userAgentFamily: pick(['Chrome', 'Safari', 'Edge', 'Firefox']),
      pasteInKeyFields: rng() < 0.12,
      questionnaireDurationSec: int(65, 640),
      submittedLocalHour: int(0, 23),
    },
    financial: {
      annualIncome: income,
      coverageAmount: coverage,
      existingPolicies: int(0, 3),
      coverageIncomeRatio: Number((coverage / Math.max(income, 1)).toFixed(2)),
    },
    beneficiary: {
      name: `${pick(firstNames)} ${pick(lastNames)}`,
      relation,
      sameAddress: rng() < 0.72,
      isImmediateFamily: ['Spouse', 'Child', 'Parent', 'Sibling'].includes(relation),
    },
    agent: {
      id: agent.id,
      name: agent.name,
      state: agent.state,
    },
    patternTags: [],
  };
}

function injectVelocityRing(apps) {
  const sharedPhone = '+1-555-818-4400';
  const sharedDevice = 'dfp-991177';
  for (let i = 0; i < 10; i += 1) {
    apps[i].applicant.phone = sharedPhone;
    apps[i].deviceSession.deviceFingerprint = sharedDevice;
    apps[i].patternTags.push('velocity-ring');
    apps[i].carrier = carriers[i % carriers.length];
  }
}

function injectIdentityMismatch(apps) {
  for (let i = 10; i < 18; i += 1) {
    const current = apps[i].applicant.address.state;
    const mismatch = states.find((s) => s !== current) ?? 'CA';
    apps[i].applicant.ipState = mismatch;
    apps[i].patternTags.push('identity-mismatch');
    if (i % 2 === 0) {
      apps[i].patternTags.push('ssn-age-mismatch');
    } else {
      apps[i].patternTags.push('thin-credit-file');
    }
  }
}

function injectStoli(apps) {
  for (let i = 18; i < 24; i += 1) {
    apps[i].beneficiary.relation = i % 2 === 0 ? 'Trust' : 'Business Partner';
    apps[i].beneficiary.isImmediateFamily = false;
    apps[i].financial.coverageAmount = int(1500000, 2500000);
    apps[i].financial.existingPolicies = 0;
    apps[i].financial.coverageIncomeRatio = Number((apps[i].financial.coverageAmount / apps[i].financial.annualIncome).toFixed(2));
    apps[i].patternTags.push('stoli-indicator');
  }
}

function injectAgentPattern(apps, agents) {
  const rogue = agents[0];
  for (let i = 24; i < 40; i += 1) {
    apps[i].agent.id = rogue.id;
    apps[i].agent.name = rogue.name;
    apps[i].agent.state = rogue.state;
    apps[i].timestamps.completionDurationSec = int(45, 140);
    apps[i].patternTags.push('agent-anomaly');
    if (i % 5 === 0) {
      apps[i].beneficiary.name = rogue.name;
      apps[i].patternTags.push('agent-beneficiary-conflict');
    }
  }
}

function buildDataset() {
  const agents = makeAgents();
  const applications = Array.from({ length: APP_COUNT }, (_, index) =>
    makeBaseApplication(index + 1, agents),
  );

  injectVelocityRing(applications);
  injectIdentityMismatch(applications);
  injectStoli(applications);
  injectAgentPattern(applications, agents);

  return { agents, applications, rules: ruleCatalog };
}

function writeJson(filePath, value) {
  writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, 'utf-8');
}

const outDir = join(process.cwd(), 'backend', 'localdb');
const dataset = buildDataset();

writeJson(join(outDir, 'agents.json'), dataset.agents);
writeJson(join(outDir, 'applications.json'), dataset.applications);
writeJson(join(outDir, 'rules.json'), dataset.rules);

console.log(`Generated deterministic dataset with seed ${SEED}.`);
console.log(`Applications: ${dataset.applications.length}`);
console.log(`Agents: ${dataset.agents.length}`);
console.log(`Rules: ${dataset.rules.length}`);
