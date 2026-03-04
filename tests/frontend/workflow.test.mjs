import test from 'node:test';
import assert from 'node:assert/strict';

import { canTransitionCaseStatus, nextCaseStatuses } from '../../.tmp-frontend-tests/workflow.js';

test('allows valid transitions from New', () => {
  assert.equal(canTransitionCaseStatus('New', 'Escalated'), true);
  assert.equal(canTransitionCaseStatus('New', 'Cleared'), true);
});

test('blocks invalid transitions from terminal states', () => {
  assert.equal(canTransitionCaseStatus('Declined', 'Cleared'), false);
  assert.equal(canTransitionCaseStatus('Cleared', 'In Review'), false);
});

test('returns next statuses for In Review', () => {
  assert.deepEqual(nextCaseStatuses('In Review'), ['Escalated', 'Cleared', 'Declined']);
});
