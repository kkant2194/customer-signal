export type Sentiment = "positive" | "neutral" | "negative";
export type FeedbackStatus = "new" | "triaged" | "planned" | "closed";
export type WorkspaceHealth = "Active" | "Reviewing" | "Paused";
export type Plan = "Free" | "Pro" | "Business" | "Enterprise";
export type Rating = 1 | 2 | 3 | 4 | 5;

export interface Workspace {
  id: string;
  name: string;
  owner: string;
  product: string;
  sources: number;
  feedbackCount: number;
  activeMembers: number;
  health: WorkspaceHealth;
  lastSync: string;
}

export interface FeedbackItem {
  id: string;
  workspaceId: string;
  workspace: string;
  source: string;
  customer: string;
  title: string;
  excerpt: string;
  sentiment: Sentiment;
  theme: string;
  status: FeedbackStatus;
  date: string;
  revenue: string;
  rating: Rating;
  plan: Plan;
  metadata?: Record<string, unknown>;
}

export interface SavedReport {
  id: string;
  name: string;
  workspaceId: string;
  workspace: string;
  type: string;
  status: "Ready" | "Draft" | "Scheduled";
  updated: string;
  owner: string;
  question?: string;
  answer?: string;
  evidenceCount?: number;
  themes?: AnalysisTheme[];
  quotes?: AnalysisQuote[];
  actions?: string[];
}

export interface ImportPreviewRow {
  source: string;
  customer: string;
  title?: string;
  feedback: string;
  sentiment: Sentiment;
  rating: Rating;
  plan: Plan;
  metadata?: Record<string, unknown>;
  workspaceId?: string;
}

export interface RetrievedEvidence {
  item: FeedbackItem;
  score: number;
  matchedKeywords: string[];
}

export interface AnalysisTheme {
  name: string;
  count: number;
  summary: string;
}

export interface AnalysisQuote {
  id: string;
  customer: string;
  quote: string;
  source: string;
}

export interface AnalysisResult {
  id: string;
  question: string;
  shortAnswer: string;
  priority?: {
    level: "high" | "medium" | "low";
    rationale: string;
    drivers: string[];
  };
  themes: AnalysisTheme[];
  evidenceCount: number;
  quotes: AnalysisQuote[];
  actions: string[];
  retrieved: RetrievedEvidence[];
  enoughEvidence?: boolean;
}

export interface OpenAIAnalysisResponse {
  status?: "answered" | "insufficient_evidence" | "out_of_scope";
  short_answer: string;
  themes: Array<{
    name?: string;
    title?: string;
    summary: string;
    evidence_count: number;
    sentiment?: Sentiment | "mixed";
    source_ids?: string[];
    quotes?: Array<{
      source_id: string;
      quote: string;
    }>;
  }>;
  priority_summary: {
    level: "high" | "medium" | "low";
    rationale: string;
    drivers: string[];
  };
  quotes: Array<{
    source_id: string;
    customer: string;
    quote: string;
  }>;
  recommended_actions: string[];
  follow_up_questions?: string[];
  evidence_count: number;
  enough_evidence: boolean;
  retrieved_feedback_items?: Array<{
    id: string;
    source: string;
    customer: string;
    title: string;
    excerpt: string;
    sentiment: Sentiment;
    theme: string;
    rating: Rating;
    plan: Plan;
    similarity: number;
  }>;
}

export interface ImportFeedbackRequestRow {
  source: string;
  customer: string;
  title?: string;
  feedback: string;
  sentiment: Sentiment;
  rating: Rating;
  plan: Plan;
  metadata?: Record<string, unknown>;
}

export interface CustomerSignalState {
  workspaces: Workspace[];
  feedbackItems: FeedbackItem[];
  savedReports: SavedReport[];
}
