import type { Lead, LeadChanges, LeadDetail, LeadFilters, NewDiscussion, NewLead } from "./types";

const TIMEOUT_MS = 15_000;

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    /** Validation messages keyed by field name, from a 422 response. */
    readonly fieldErrors: Record<string, string> = {},
  ) {
    super(message);
    this.name = "ApiError";
  }
}

interface ValidationIssue {
  loc: (string | number)[];
  msg: string;
}

async function toApiError(response: Response): Promise<ApiError> {
  // 5xx covers both API failures and the proxy not reaching the API; neither detail helps users.
  if (response.status >= 500) {
    return new ApiError(
      "The server isn't responding right now. Please try again in a moment.",
      response.status,
    );
  }

  const body: { detail?: unknown } | null = await response.json().catch(() => null);
  const detail = body?.detail;

  if (typeof detail === "string") return new ApiError(detail, response.status);
  if (Array.isArray(detail) && detail.length > 0) {
    const issues = detail as ValidationIssue[];
    // loc is ["body", "<field>"]; strip the "body" prefix.
    const fieldErrors = Object.fromEntries(
      issues.map((issue) => [issue.loc.slice(1).join("."), issue.msg]),
    );
    return new ApiError(issues[0].msg, response.status, fieldErrors);
  }
  return new ApiError(`Request failed (${response.status}).`, response.status);
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const timeout = AbortSignal.timeout(TIMEOUT_MS);
  let response: Response;
  try {
    response = await fetch(`/api${path}`, {
      ...init,
      headers: { Accept: "application/json", "Content-Type": "application/json" },
      signal: init.signal ? AbortSignal.any([init.signal, timeout]) : timeout,
    });
  } catch (error) {
    if (init.signal?.aborted) throw error; // cancelled by React Query, not a failure
    throw new ApiError(
      timeout.aborted
        ? "The server took too long to respond. Please try again."
        : "Can't reach the server. Check your connection and try again.",
      0,
    );
  }
  if (!response.ok) throw await toApiError(response);
  return (await response.json()) as T;
}

export const api = {
  listLeads(filters: LeadFilters, signal?: AbortSignal) {
    const params = new URLSearchParams();
    if (filters.status) params.set("status", filters.status);
    if (filters.q) params.set("q", filters.q);
    const query = params.toString();
    return request<Lead[]>(query ? `/leads?${query}` : "/leads", { signal });
  },
  getLead(id: number, signal?: AbortSignal) {
    return request<LeadDetail>(`/leads/${id}`, { signal });
  },
  createLead(input: NewLead) {
    return request<LeadDetail>("/leads", { method: "POST", body: JSON.stringify(input) });
  },
  updateLead(id: number, changes: LeadChanges) {
    return request<LeadDetail>(`/leads/${id}`, { method: "PATCH", body: JSON.stringify(changes) });
  },
  addDiscussion(id: number, input: NewDiscussion) {
    return request<LeadDetail>(`/leads/${id}/discussions`, {
      method: "POST",
      body: JSON.stringify(input),
    });
  },
};

export function errorMessage(error: unknown): string {
  return error instanceof ApiError ? error.message : "Something went wrong. Please try again.";
}
