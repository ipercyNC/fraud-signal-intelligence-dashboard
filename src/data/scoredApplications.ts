import applications from '../../backend/localdb/applications.json';
import rules from '../../backend/localdb/rules.json';
import { scoreApplications } from '../domain/scoring';
import type { RawApplication, RuleConfig, ScoredApplication } from '../domain/types';

export const scoredApplications: ScoredApplication[] = scoreApplications(
  applications as RawApplication[],
  rules as RuleConfig[],
);

export const scoredApplicationById = new Map(scoredApplications.map((app) => [app.id, app]));
