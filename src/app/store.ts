import { create } from 'zustand';
import { addCaseNote, generateAIBrief, getApplications, getCases, getHealth, getRules, login, setAccessToken, setCaseDisposition } from '../api/client';
import { caseOutcomes as fallbackCaseOutcomes } from '../data/caseOutcomes';
import { scoredApplications as fallbackScoredApps } from '../data/scoredApplications';
import fallbackRules from '../../backend/localdb/rules.json';
import { scoreApplications } from '../domain/scoring';
import type { AIBrief, CaseRecord, CaseStatus, Note, RawApplication, RuleConfig, ScoredApplication } from '../domain/types';

export type AppView = 'Live Queue' | 'Signal Library' | 'Analytics' | 'Case History';

interface AppStore {
  activeView: AppView;
  isDetailPanelCollapsed: boolean;
  selectedApplicationId: string;
  scoredApplications: ScoredApplication[];
  rules: RuleConfig[];
  casesById: Record<string, CaseRecord>;
  aiBriefById: Record<string, AIBrief>;
  aiLoadingById: Record<string, boolean>;
  loading: boolean;
  apiOnline: boolean;
  apiWritable: boolean;
  bootstrapError: string | null;
  setActiveView: (view: AppView) => void;
  toggleDetailPanel: () => void;
  setSelectedApplicationId: (applicationId: string) => void;
  bootstrap: () => Promise<void>;
  authenticate: (email: string, password: string) => Promise<void>;
  logout: () => void;
  setCaseStatus: (applicationId: string, status: CaseStatus) => Promise<void>;
  addNote: (applicationId: string, text: string, author?: string) => Promise<void>;
  getAIBrief: (applicationId: string, forceRefresh?: boolean) => Promise<void>;
}

function buildCaseMap(rows: CaseRecord[]): Record<string, CaseRecord> {
  return rows.reduce<Record<string, CaseRecord>>((acc, row) => {
    acc[row.applicationId] = row;
    return acc;
  }, {});
}

function fallbackCases(): Record<string, CaseRecord> {
  return fallbackCaseOutcomes.reduce<Record<string, CaseRecord>>((acc, row) => {
    acc[row.applicationId] = { ...row, notes: [] };
    return acc;
  }, {});
}

function newNote(applicationId: string, text: string, author = 'Investigator'): Note {
  return {
    id: `${applicationId}-${Date.now()}`,
    author,
    timestamp: new Date().toISOString(),
    text,
  };
}

let bootstrapPromise: Promise<void> | null = null;

export const useAppStore = create<AppStore>((set, get) => ({
  activeView: 'Live Queue',
  isDetailPanelCollapsed: false,
  selectedApplicationId: fallbackScoredApps[0]?.id ?? 'APP-0001',
  scoredApplications: fallbackScoredApps,
  rules: fallbackRules as RuleConfig[],
  casesById: fallbackCases(),
  aiBriefById: {},
  aiLoadingById: {},
  loading: false,
  apiOnline: false,
  apiWritable: false,
  bootstrapError: null,
  setActiveView: (view) => set({ activeView: view }),
  toggleDetailPanel: () =>
    set((state) => ({
      isDetailPanelCollapsed: !state.isDetailPanelCollapsed,
    })),
  setSelectedApplicationId: (applicationId) => set({ selectedApplicationId: applicationId }),
  bootstrap: async () => {
    if (bootstrapPromise) return bootstrapPromise;

    bootstrapPromise = (async () => {
      set({ loading: true, bootstrapError: null });
      try {
        await getHealth();
        set({
          loading: false,
          apiOnline: true,
          apiWritable: false,
          bootstrapError: null,
        });
      } catch (error) {
        setAccessToken(null);
        const message = error instanceof Error ? error.message : 'Unknown API error';
        set({
          scoredApplications: fallbackScoredApps,
          rules: fallbackRules as RuleConfig[],
          casesById: fallbackCases(),
          selectedApplicationId: fallbackScoredApps[0]?.id ?? 'APP-0001',
          loading: false,
          apiOnline: false,
          apiWritable: false,
          bootstrapError: `API unavailable: ${message}.`,
        });
      }
    })();

    await bootstrapPromise;
  },
  authenticate: async (email, password) => {
    const normalizedEmail = email.trim().toLowerCase();
    const normalizedPassword = password.trim();
    if (!normalizedEmail || !normalizedPassword) {
      throw new Error('Email and password are required');
    }

    try {
      await login(normalizedEmail, normalizedPassword);
      const [applications, rules, cases] = await Promise.all([
        getApplications(),
        getRules(),
        getCases(),
      ]);
      const scored = scoreApplications(applications as RawApplication[], rules);
      set({
        scoredApplications: scored,
        rules,
        casesById: buildCaseMap(cases),
        selectedApplicationId: scored[0]?.id ?? 'APP-0001',
        apiWritable: true,
        apiOnline: true,
        bootstrapError: null,
      });
    } catch (error) {
      setAccessToken(null);
      throw error instanceof Error ? error : new Error('Authentication failed');
    }
  },
  logout: () => {
    setAccessToken(null);
    set({ apiWritable: false, bootstrapError: null });
  },
  setCaseStatus: async (applicationId, status) => {
    const state = get();
    if (state.apiOnline && state.apiWritable) {
      const updated = await setCaseDisposition(applicationId, status);
      set((current) => ({
        casesById: {
          ...current.casesById,
          [applicationId]: updated,
        },
      }));
      return;
    }

    set((current) => {
      const existing = current.casesById[applicationId];
      if (!existing) return current;

      return {
        casesById: {
          ...current.casesById,
          [applicationId]: {
            ...existing,
            finalDisposition: status,
          },
        },
      };
    });
  },
  addNote: async (applicationId, text, author = 'Investigator') => {
    const noteText = text.trim();
    if (!noteText) return;

    const state = get();
    if (state.apiOnline && state.apiWritable) {
      const updated = await addCaseNote(applicationId, noteText);
      set((current) => ({
        casesById: {
          ...current.casesById,
          [applicationId]: updated,
        },
      }));
      return;
    }

    set((current) => {
      const existing = current.casesById[applicationId];
      if (!existing) return current;

      return {
        casesById: {
          ...current.casesById,
          [applicationId]: {
            ...existing,
            notes: [newNote(applicationId, noteText, author), ...existing.notes],
          },
        },
      };
    });
  },
  getAIBrief: async (applicationId, forceRefresh = false) => {
    const state = get();
    if (!state.apiOnline || !state.apiWritable) return;

    set((current) => ({
      aiLoadingById: {
        ...current.aiLoadingById,
        [applicationId]: true,
      },
    }));

    try {
      const result = await generateAIBrief(applicationId, forceRefresh);
      set((current) => ({
        aiBriefById: {
          ...current.aiBriefById,
          [applicationId]: result,
        },
      }));
    } finally {
      set((current) => ({
        aiLoadingById: {
          ...current.aiLoadingById,
          [applicationId]: false,
        },
      }));
    }
  },
}));
