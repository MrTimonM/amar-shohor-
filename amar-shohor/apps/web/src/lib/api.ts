import type {
  ApiError,
  DashboardStats,
  Department,
  IssueDetail,
  IssueSummary,
  Me,
  Photo,
  ReportSummary,
} from '@amar/shared';

/**
 * One place that talks to the API. Vite proxies /v1 to the API in dev, so the
 * browser stays on a single origin and nothing depends on CORS locally.
 */

const TOKEN_KEY = 'amar.token';

export const getToken = (): string | null => {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
};

export const setToken = (token: string | null) => {
  try {
    if (token) localStorage.setItem(TOKEN_KEY, token);
    else localStorage.removeItem(TOKEN_KEY);
  } catch {
    /* private mode: the session simply does not persist */
  }
};

export class ApiFailure extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly fields?: Record<string, string>,
  ) {
    super(message);
  }
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const token = getToken();
  const headers = new Headers(init.headers);
  if (!(init.body instanceof FormData)) headers.set('content-type', 'application/json');
  if (token) headers.set('authorization', `Bearer ${token}`);

  let res: Response;
  try {
    res = await fetch(`/v1${path}`, { ...init, headers });
  } catch {
    // Distinguishing "offline" from "server said no" matters: phase 05 queues
    // the former and shows an error for the latter.
    throw new ApiFailure(0, 'offline', 'You appear to be offline. Your report is saved and will send itself.');
  }

  if (res.status === 204) return undefined as T;

  const text = await res.text();
  const body = text ? (JSON.parse(text) as unknown) : null;

  if (!res.ok) {
    const err = (body ?? {}) as ApiError;
    if (res.status === 401) setToken(null);
    throw new ApiFailure(res.status, err.error ?? 'error', err.message ?? 'Something went wrong', err.fields);
  }

  return body as T;
}

export interface IssueFilters {
  bbox?: string;
  category?: string[];
  status?: string[];
  band?: string;
  ward?: string;
  q?: string;
  sort?: 'priority' | 'newest' | 'oldest' | 'reports';
  limit?: number;
}

const qs = (params: Record<string, string | number | undefined>) => {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== '') search.set(key, String(value));
  }
  const str = search.toString();
  return str ? `?${str}` : '';
};


/** Rows the admin console renders. Shaped by the API, not by the DB document. */
export interface StaffCodeRow {
  id: string;
  code: string;
  department: Department | null;
  label: string | null;
  createdByName: string | null;
  createdAt: string | null;
  expiresAt: string | null;
  maxUses: number | null;
  useCount: number;
  lastUsedAt: string | null;
  state: 'active' | 'revoked' | 'expired' | 'used_up';
}

export interface StaffRow {
  id: string;
  name: string;
  email: string;
  role: string;
  department: Department | null;
  trust: number;
  lastSeenAt: string | null;
  createdAt: string | null;
  openAssigned: number;
}

export const api = {
  /** Not under /v1 — it is the load-balancer probe as well as a UI signal. */
  health: async () => {
    const res = await fetch('/health');
    if (!res.ok) throw new ApiFailure(res.status, 'unhealthy', 'The API is not responding');
    return (await res.json()) as { ok: boolean; ai: { up: boolean; models?: string[] }; storage: string; queueDepth: number };
  },

  /**
   * Sign-up and sign-in. Both return a session token and the account, so the
   * caller never has to follow one with a `me()` round trip.
   */
  signup: (input: { name: string; email: string; password: string; department?: Department; staffCode?: string }) =>
    request<{ token: string; user: Me }>('/auth/signup', {
      method: 'POST',
      body: JSON.stringify(input),
    }),

  login: (email: string, password: string) =>
    request<{ token: string; user: Me }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    }),

  /** Drives the authority side of the sign-up form. */
  departments: () =>
    request<{ staffSignupOpen: boolean; departments: { key: Department; en: string; bn: string }[] }>(
      '/auth/departments',
    ),

  me: () => request<Me>('/auth/me'),

  issues: (filters: IssueFilters = {}) =>
    request<{ items: IssueSummary[]; total: number }>(
      `/issues${qs({
        bbox: filters.bbox,
        category: filters.category?.join(','),
        status: filters.status?.join(','),
        band: filters.band,
        ward: filters.ward,
        q: filters.q,
        sort: filters.sort,
        limit: filters.limit,
      })}`,
    ),

  issue: (id: string, at?: { lat: number; lng: number }) =>
    request<IssueDetail>(`/issues/${id}${at ? qs({ at: `${at.lat},${at.lng}` }) : ''}`),

  verifyIssue: (id: string, vote: 'confirm' | 'dispute', at: { lat: number; lng: number }, note?: string) =>
    request<{ verification: IssueSummary['verification']; statusChanged: boolean }>(`/issues/${id}/verify`, {
      method: 'POST',
      body: JSON.stringify({ vote, at: { type: 'Point', coordinates: [at.lng, at.lat] }, note }),
    }),

  uploadPhotos: (files: File[]) => {
    const form = new FormData();
    for (const file of files) form.append('photos', file);
    return request<{ photos: Photo[] }>('/media/photos', { method: 'POST', body: form });
  },

  createReport: (payload: {
    category: string;
    severity?: number;
    description?: string;
    location: { type: 'Point'; coordinates: [number, number] };
    accuracy?: number;
    photoIds: string[];
    confirmsIssueId?: string;
    queuedOffline?: boolean;
  }) =>
    request<{ report: ReportSummary; issue?: IssueSummary; pending?: boolean; dedup?: { decision: string; reason: string } }>(
      '/reports',
      { method: 'POST', body: JSON.stringify(payload) },
    ),

  myReports: () => request<{ items: (ReportSummary & { issue?: IssueSummary })[] }>('/reports/mine'),

  nearby: (lat: number, lng: number, category?: string, radius = 120) =>
    request<{ items: (IssueSummary & { distanceM: number })[] }>(`/reports/nearby${qs({ lat, lng, category, radius })}`),

  queue: (view?: 'mine' | 'unassigned' | 'overdue') =>
    request<{ items: IssueSummary[]; counts: { total: number; unassigned: number; overdue: number } }>(
      `/authority/queue${qs({ status: view })}`,
    ),

  changeStatus: (id: string, payload: { to: string; note: string; proofPhotoIds?: string[]; assigneeId?: string }) =>
    request<{ issue: IssueSummary }>(`/authority/issues/${id}/status`, { method: 'POST', body: JSON.stringify(payload) }),

  signOff: (id: string, accept: boolean, note?: string) =>
    request<{ ok: boolean; signedOff?: boolean; reopened?: boolean }>(`/authority/issues/${id}/signoff`, {
      method: 'POST',
      body: JSON.stringify({ accept, note }),
    }),

  reviewQueue: () =>
    request<{
      items: {
        report: ReportSummary;
        candidates: { issue: IssueSummary; match: { score: number; factors: { key: string; detail: string; value: number; weight: number }[] } }[];
        reason?: string;
      }[];
      total: number;
    }>('/authority/review'),

  decideMerge: (payload: { reportId: string; action: 'merge' | 'split' | 'reject'; targetIssueId?: string; note?: string }) =>
    request<{ ok: boolean; action: string; issueId?: string }>('/authority/review', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  /* --- admin console (admin role only) --- */

  staffCodes: () => request<{ items: StaffCodeRow[] }>('/admin/staff-codes'),

  createStaffCode: (input: { department?: Department; label?: string; expiresInDays?: number; maxUses?: number }) =>
    request<StaffCodeRow>('/admin/staff-codes', { method: 'POST', body: JSON.stringify(input) }),

  /** Revoke by default; `hard` erases a code that never created an account. */
  removeStaffCode: (id: string, hard = false) =>
    request<{ ok: boolean; revoked?: boolean; deleted?: boolean }>(`/admin/staff-codes/${id}${hard ? '?hard=1' : ''}`, {
      method: 'DELETE',
    }),

  staff: () => request<{ items: StaffRow[] }>('/admin/staff'),

  setStaffRole: (id: string, role: string, department?: Department) =>
    request<{ ok: boolean; role: string; department: Department | null }>(`/admin/staff/${id}`, {
      method: 'PATCH',
      body: JSON.stringify({ role, department }),
    }),

  /** Demote to citizen by default; `hard` deletes the account outright. */
  removeStaff: (id: string, hard = false) =>
    request<{ ok: boolean; demoted?: boolean; deleted?: boolean; openAssigned?: number }>(
      `/admin/staff/${id}${hard ? '?hard=1' : ''}`,
      { method: 'DELETE' },
    ),

  dashboard: () => request<DashboardStats>('/stats/dashboard'),

  wards: () =>
    request<{
      items: {
        id: string;
        name: string;
        nameBn: string;
        cityCorporation: string;
        densityPerKm2: number;
        boundary?: { type: 'Polygon'; coordinates: number[][][] };
      }[];
    }>('/stats/wards'),
};
