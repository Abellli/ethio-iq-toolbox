const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/api/v1';

function getAccessToken() {
  if (typeof window === 'undefined') return null;
  return window.localStorage.getItem('access_token');
}

export async function apiFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  const token = getAccessToken();
  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...init.headers,
    },
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.message ?? `Request failed: ${res.status}`);
  }
  return res.json();
}

async function apiFetchBlob(path: string): Promise<Blob> {
  const token = getAccessToken();
  const res = await fetch(`${API_BASE}${path}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (!res.ok) throw new Error(`Export failed: ${res.status}`);
  return res.blob();
}

export async function login(email: string, password: string) {
  const data = await apiFetch<{ accessToken: string; refreshToken: string }>('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });
  window.localStorage.setItem('access_token', data.accessToken);
  window.localStorage.setItem('refresh_token', data.refreshToken);
  return data;
}

// ---- Surveys ----
import type { Question, Survey } from './types';

export function listSurveys() {
  return apiFetch<Survey[]>('/surveys');
}

export function createSurvey(input: { title: string; description?: string; tier?: string }) {
  return apiFetch<Survey>('/surveys', { method: 'POST', body: JSON.stringify(input) });
}

export function getSurvey(id: string) {
  return apiFetch<Survey>(`/surveys/${id}`);
}

export function updateSurvey(id: string, input: Partial<Survey>) {
  return apiFetch<Survey>(`/surveys/${id}`, { method: 'PATCH', body: JSON.stringify(input) });
}

export function saveQuestions(id: string, questions: Question[]) {
  const payload = questions.map(({ clientKey, ...rest }) => rest);
  return apiFetch<Question[]>(`/surveys/${id}/questions`, {
    method: 'POST',
    body: JSON.stringify({ questions: payload }),
  });
}

export function publishSurvey(id: string) {
  return apiFetch<Survey>(`/surveys/${id}/publish`, { method: 'POST' });
}

export function pauseSurvey(id: string) {
  return apiFetch<Survey>(`/surveys/${id}/pause`, { method: 'POST' });
}

export function closeSurvey(id: string) {
  return apiFetch<Survey>(`/surveys/${id}/close`, { method: 'POST' });
}

export function saveGeofence(
  id: string,
  input: { label?: string; centerLat?: number; centerLng?: number; radiusMeters?: number },
) {
  return apiFetch(`/surveys/${id}/geofence`, { method: 'POST', body: JSON.stringify(input) });
}

// ---- Billing / campaigns ----
export interface Wallet {
  walletBalanceCents: number;
  currency: string;
}

export interface Transaction {
  id: string;
  type: 'payout' | 'client_charge' | 'refund';
  amount_cents: number;
  currency: string;
  status: 'pending' | 'completed' | 'failed';
  payment_method: string | null;
  created_at: string;
}

export interface SurveySpend {
  survey_id: string;
  title: string;
  status: string;
  budget_cap_cents: number | null;
  incentive_amount_cents: number;
  spent_cents: number;
  verified_responses: string;
}

export function getWallet() {
  return apiFetch<Wallet>('/billing/wallet');
}

export function listTransactions() {
  return apiFetch<Transaction[]>('/billing/transactions');
}

export function requestTopup(amountCents: number, paymentMethod?: string) {
  return apiFetch('/billing/topup', {
    method: 'POST',
    body: JSON.stringify({ amountCents, paymentMethod }),
  });
}

export function confirmTopup(transactionId: string) {
  return apiFetch(`/billing/topup/${transactionId}/confirm`, { method: 'POST' });
}

export function getSpendBySurvey() {
  return apiFetch<SurveySpend[]>('/billing/spend');
}

// ---- Analytics engine v1 ----
export interface AnalyticsFilter {
  region?: string;
  gender?: string;
  ageMin?: number;
  ageMax?: number;
  dateFrom?: string;
  dateTo?: string;
}

export interface Kpis {
  totalResponses: number;
  completionRate: number;
  fraudFlaggedPct: number;
  avgSentiment: number | null;
}

export interface SentimentBreakdown {
  positive: number;
  neutral: number;
  negative: number;
}

export interface TrendPoint {
  date: string;
  count: number;
}

export interface CrossTabResult {
  rows: string[];
  columns: string[];
  cells: Record<string, Record<string, number>>;
}

function toQueryString(filter: AnalyticsFilter & Record<string, unknown> = {}) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(filter)) {
    if (value !== undefined && value !== null && value !== '') params.set(key, String(value));
  }
  const qs = params.toString();
  return qs ? `?${qs}` : '';
}

export function getKpis(surveyId: string, filter: AnalyticsFilter = {}) {
  return apiFetch<Kpis>(`/analytics/surveys/${surveyId}/kpis${toQueryString(filter)}`);
}

export function getSentimentBreakdown(surveyId: string, filter: AnalyticsFilter = {}) {
  return apiFetch<SentimentBreakdown>(
    `/analytics/surveys/${surveyId}/sentiment-breakdown${toQueryString(filter)}`,
  );
}

export function getTrend(surveyId: string, filter: AnalyticsFilter = {}) {
  return apiFetch<TrendPoint[]>(`/analytics/surveys/${surveyId}/trend${toQueryString(filter)}`);
}

export function getCrossTab(
  surveyId: string,
  rowQuestionId: string,
  columnQuestionId: string,
  filter: AnalyticsFilter = {},
) {
  return apiFetch<CrossTabResult>(
    `/analytics/surveys/${surveyId}/crosstab${toQueryString({ ...filter, rowQuestionId, columnQuestionId })}`,
  );
}

export interface HeatmapPoint {
  lat: number;
  lng: number;
  weight: number;
}

export interface SunburstNode {
  name: string;
  value?: number;
  children?: SunburstNode[];
}

export function getHeatmapPoints(surveyId: string, filter: AnalyticsFilter = {}) {
  return apiFetch<HeatmapPoint[]>(`/analytics/surveys/${surveyId}/heatmap${toQueryString(filter)}`);
}

export function getSunburstData(surveyId: string, filter: AnalyticsFilter = {}) {
  return apiFetch<SunburstNode>(`/analytics/surveys/${surveyId}/sunburst${toQueryString(filter)}`);
}

export async function downloadCsvExport(surveyId: string, filter: AnalyticsFilter = {}) {
  const blob = await apiFetchBlob(
    `/analytics/surveys/${surveyId}/export.csv${toQueryString(filter)}`,
  );
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `survey-${surveyId}-export.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

// ---- Public submission (web-form fallback, no auth) ----
const PUBLIC_API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/api/v1';

export async function getPublicSurvey(id: string) {
  const res = await fetch(`${PUBLIC_API_BASE}/public/surveys/${id}`);
  if (!res.ok) throw new Error((await res.json().catch(() => ({}))).message ?? 'Survey not found');
  return res.json();
}

export async function submitPublicResponse(
  id: string,
  payload: {
    deviceFingerprintHash: string;
    gpsLat?: number;
    gpsLng?: number;
    gpsAccuracyMeters?: number;
    completionSeconds?: number;
    answers: { questionId: string; answerValue: unknown }[];
  },
) {
  const res = await fetch(`${PUBLIC_API_BASE}/public/surveys/${id}/responses`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error((await res.json().catch(() => ({}))).message ?? 'Submission failed');
  return res.json();
}
