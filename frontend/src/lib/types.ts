// Mirrors the FastAPI schemas (backend/app/schemas.py). Timestamps are ISO 8601 strings in UTC.

export const LEAD_STATUSES = [
  "new",
  "contacted",
  "qualified",
  "proposal_sent",
  "won",
  "lost",
] as const;

export type LeadStatus = (typeof LEAD_STATUSES)[number];

export const STATUS_LABELS: Record<LeadStatus, string> = {
  new: "New",
  contacted: "Contacted",
  qualified: "Qualified",
  proposal_sent: "Proposal Sent",
  won: "Won",
  lost: "Lost",
};

export interface Lead {
  id: number;
  name: string;
  company: string | null;
  phone: string | null;
  status: LeadStatus;
  follow_up_at: string | null;
  last_note: string | null;
  last_note_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface Discussion {
  id: number;
  kind: "note" | "event";
  body: string;
  follow_up_at: string | null;
  created_at: string;
}

export interface LeadDetail extends Lead {
  /** Newest first. */
  discussions: Discussion[];
}

export interface LeadFilters {
  status?: LeadStatus;
  q?: string;
}

export interface NewLead {
  name: string;
  company: string | null;
  phone: string | null;
}

export interface LeadChanges {
  status?: LeadStatus;
  /** `null` clears the follow-up. */
  follow_up_at?: string | null;
}

export interface NewDiscussion {
  body: string;
  follow_up_at?: string;
}
