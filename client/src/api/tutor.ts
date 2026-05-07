const API_BASE = import.meta.env['VITE_API_URL'] ?? 'http://localhost:3001';

// ── Shared types ──────────────────────────────────────────────────────────────

export type Source = {
  text: string;
  module: string;
  course: string;
  source: string;
};

// ── Ask endpoint ──────────────────────────────────────────────────────────────

export type AskPayload = {
  question: string;
  studentId: string;
  module?: string;
  course?: string;
  mode?: string;
};

export type AskSuccess = {
  answer: string;
  sources: Source[];
  confidence: number;
  mode: string;
  needsHumanReview: false;
};

export type AskReview = {
  status: 'review_required';
  message: string;
};

export type AskNoAnswer = {
  status: 'no_answer';
  reason: string;
  message: string;
};

export type AskValidationError = {
  status: 'error';
  errors: Array<{ msg: string; path: string; type: string; location: string }>;
};

export type AskResponse = AskSuccess | AskReview | AskNoAnswer | AskValidationError;

export async function askQuestion(payload: AskPayload): Promise<AskResponse> {
  const res = await fetch(`${API_BASE}/api/tutor-cmdq/ask`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  return res.json() as Promise<AskResponse>;
}

// ── History endpoint ──────────────────────────────────────────────────────────

export type InteractionRow = {
  id: string;
  studentId: string;
  question: string;
  answer: string;
  sources: Source[];
  module: string;
  course: string;
  mode: string;
  confidence: number;
  reviewStatus: 'pending' | 'approved' | 'not_required';
  createdAt: string;
};

export type HistoryResponse = {
  studentId: string;
  count: number;
  interactions: InteractionRow[];
};

export async function getHistory(studentId: string): Promise<HistoryResponse> {
  const res = await fetch(
    `${API_BASE}/api/tutor-cmdq/history/${encodeURIComponent(studentId)}`,
  );
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json() as Promise<HistoryResponse>;
}
