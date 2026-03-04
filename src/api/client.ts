import type { AIBrief, CaseRecord, CaseStatus, RawApplication, RuleConfig } from '../domain/types';

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? '/api';
let accessToken: string | null = null;

interface LoginResponse {
  accessToken: string;
}

interface HealthResponse {
  status: string;
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const headers = new Headers(init?.headers ?? undefined);
  headers.set('Content-Type', 'application/json');
  if (accessToken) {
    headers.set('Authorization', `Bearer ${accessToken}`);
  }

  const response = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers,
  });

  if (!response.ok) {
    let detail = response.statusText;
    try {
      const body = (await response.json()) as { detail?: string };
      if (body.detail) detail = body.detail;
    } catch {
      // no-op
    }
    throw new Error(`API ${response.status}: ${detail}`);
  }

  return (await response.json()) as T;
}

export function setAccessToken(token: string | null): void {
  accessToken = token;
}

export async function login(email: string, password: string): Promise<void> {
  const result = await request<LoginResponse>('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });
  setAccessToken(result.accessToken);
}

export function getHealth(): Promise<HealthResponse> {
  return request<HealthResponse>('/health');
}

export function getApplications(): Promise<RawApplication[]> {
  return request<RawApplication[]>('/applications');
}

export function getRules(): Promise<RuleConfig[]> {
  return request<RuleConfig[]>('/rules');
}

export function getCases(): Promise<CaseRecord[]> {
  return request<CaseRecord[]>('/cases');
}

export function addCaseNote(applicationId: string, text: string): Promise<CaseRecord> {
  return request<CaseRecord>(`/cases/${applicationId}/notes`, {
    method: 'POST',
    body: JSON.stringify({ text }),
  });
}

export function setCaseDisposition(applicationId: string, status: CaseStatus): Promise<CaseRecord> {
  return request<CaseRecord>(`/cases/${applicationId}/disposition`, {
    method: 'POST',
    body: JSON.stringify({ status }),
  });
}

export function generateAIBrief(applicationId: string, forceRefresh = false): Promise<AIBrief> {
  return request<AIBrief>(`/cases/${applicationId}/ai-brief`, {
    method: 'POST',
    body: JSON.stringify({ forceRefresh }),
  });
}
