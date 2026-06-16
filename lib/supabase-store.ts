"use client";

import { requireSupabaseClient } from "@/lib/supabase/client";
import type {
  AnalysisTheme,
  AnalysisQuote,
  CustomerSignalState,
  FeedbackItem,
  FeedbackStatus,
  Plan,
  Rating,
  SavedReport,
  Sentiment,
  Workspace,
  WorkspaceHealth
} from "@/lib/types";

interface WorkspaceRow {
  id: string;
  user_id: string;
  name: string;
  owner: string;
  product: string;
  active_members: number;
  health: WorkspaceHealth;
  created_at: string;
  updated_at: string;
}

interface FeedbackRow {
  id: string;
  user_id: string;
  workspace_id: string;
  source: string;
  customer: string;
  title: string;
  excerpt: string;
  sentiment: Sentiment;
  theme: string;
  status: FeedbackStatus;
  revenue: string;
  rating: Rating;
  plan: Plan;
  metadata: Record<string, unknown> | null;
  feedback_date: string;
  created_at: string;
}

interface ReportRow {
  id: string;
  user_id: string;
  workspace_id: string | null;
  name: string;
  type: string;
  status: "Ready" | "Draft" | "Scheduled";
  owner: string;
  question: string | null;
  answer: string | null;
  evidence_count: number | null;
  themes: AnalysisTheme[] | null;
  quotes: AnalysisQuote[] | null;
  actions: string[] | null;
  updated_at: string;
  workspaces?: { name: string } | null;
}

export async function fetchCustomerSignalState(): Promise<CustomerSignalState> {
  const supabase = requireSupabaseClient();

  const [workspaceResult, feedbackResult, reportsResult] = await Promise.all([
    supabase.from("workspaces").select("*").order("created_at", { ascending: true }),
    supabase.from("feedback_items").select("*").order("created_at", { ascending: false }),
    supabase
      .from("saved_reports")
      .select("*, workspaces(name)")
      .order("updated_at", { ascending: false })
  ]);

  if (workspaceResult.error) throw workspaceResult.error;
  if (feedbackResult.error) throw feedbackResult.error;
  if (reportsResult.error) throw reportsResult.error;

  const feedbackRows = (feedbackResult.data ?? []) as FeedbackRow[];
  const workspaces = ((workspaceResult.data ?? []) as WorkspaceRow[]).map((row) =>
    mapWorkspace(row, feedbackRows)
  );
  const workspaceNameById = new Map(workspaces.map((workspace) => [workspace.id, workspace.name]));
  const feedbackItems = feedbackRows.map((row) =>
    mapFeedback(row, workspaceNameById.get(row.workspace_id) ?? "Deleted workspace")
  );
  const savedReports = ((reportsResult.data ?? []) as ReportRow[]).map(mapReport);

  return { workspaces, feedbackItems, savedReports };
}

export async function createUserProfile(email: string, fullName: string) {
  const supabase = requireSupabaseClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) throw new Error("No authenticated user.");

  const { error } = await supabase.from("profiles").upsert({
    id: data.user.id,
    email,
    full_name: fullName || email,
    updated_at: new Date().toISOString()
  });
  if (error) throw error;
}

export async function createWorkspace(input: Pick<Workspace, "name" | "product" | "owner">) {
  const supabase = requireSupabaseClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) throw new Error("No authenticated user.");

  const { error } = await supabase.from("workspaces").insert({
    user_id: data.user.id,
    name: input.name.trim(),
    product: input.product.trim() || "Product area",
    owner: input.owner.trim() || data.user.email || "Product team",
    active_members: 1,
    health: "Active"
  });
  if (error) throw error;
}

export async function renameWorkspace(workspaceId: string, name: string) {
  const supabase = requireSupabaseClient();
  const { error } = await supabase
    .from("workspaces")
    .update({ name: name.trim(), updated_at: new Date().toISOString() })
    .eq("id", workspaceId);
  if (error) throw error;
}

export async function deleteWorkspace(workspaceId: string) {
  const supabase = requireSupabaseClient();
  const { error: feedbackError } = await supabase
    .from("feedback_items")
    .delete()
    .eq("workspace_id", workspaceId);
  if (feedbackError) throw feedbackError;

  const { error: reportError } = await supabase
    .from("saved_reports")
    .delete()
    .eq("workspace_id", workspaceId);
  if (reportError) throw reportError;

  const { error } = await supabase.from("workspaces").delete().eq("id", workspaceId);
  if (error) throw error;
}

export async function saveAnalysisReport(report: SavedReport) {
  const supabase = requireSupabaseClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) throw new Error("No authenticated user.");

  const { error } = await supabase.from("saved_reports").insert({
    user_id: data.user.id,
    workspace_id: report.workspaceId === "all" ? null : report.workspaceId,
    name: report.name,
    type: report.type,
    status: report.status,
    owner: report.owner,
    question: report.question ?? null,
    answer: report.answer ?? null,
    evidence_count: report.evidenceCount ?? null,
    themes: report.themes ?? null,
    quotes: report.quotes ?? null,
    actions: report.actions ?? null
  });
  if (error) throw error;
}

function mapWorkspace(row: WorkspaceRow, feedbackRows: FeedbackRow[]): Workspace {
  const workspaceFeedback = feedbackRows.filter((item) => item.workspace_id === row.id);
  return {
    id: row.id,
    name: row.name,
    owner: row.owner,
    product: row.product,
    sources: new Set(workspaceFeedback.map((item) => item.source)).size,
    feedbackCount: workspaceFeedback.length,
    activeMembers: row.active_members,
    health: row.health,
    lastSync: "Live"
  };
}

function mapFeedback(row: FeedbackRow, workspace: string): FeedbackItem {
  return {
    id: row.id,
    workspaceId: row.workspace_id,
    workspace,
    source: row.source,
    customer: row.customer,
    title: row.title,
    excerpt: row.excerpt,
    sentiment: row.sentiment,
    theme: row.theme,
    status: row.status,
    date: row.feedback_date,
    revenue: row.revenue,
    rating: row.rating,
    plan: row.plan,
    metadata: row.metadata ?? undefined
  };
}

function mapReport(row: ReportRow): SavedReport {
  return {
    id: row.id,
    name: row.name,
    workspaceId: row.workspace_id ?? "all",
    workspace: row.workspaces?.name ?? "All workspaces",
    type: row.type,
    status: row.status,
    updated: new Date(row.updated_at).toLocaleDateString(),
    owner: row.owner,
    question: row.question ?? undefined,
    answer: row.answer ?? undefined,
    evidenceCount: row.evidence_count ?? undefined,
    themes: row.themes ?? undefined,
    quotes: row.quotes ?? undefined,
    actions: row.actions ?? undefined
  };
}
