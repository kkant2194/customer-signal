import { NextRequest, NextResponse } from "next/server";
import {
  analyzeWithOpenAI,
  buildWeakEvidenceResponse,
  createEmbedding,
  type RagFeedbackItem
} from "@/lib/server/openai";
import {
  createAuthenticatedSupabase,
  getAuthenticatedUser,
  requireBearerToken,
  trackUsage
} from "@/lib/server/supabase";
import type { OpenAIAnalysisResponse, Plan, Rating, Sentiment } from "@/lib/types";

export const runtime = "nodejs";

interface AnalyzeRequestBody {
  workspace_id?: string;
  question?: string;
}

interface MatchFeedbackRow {
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
}

export async function POST(request: NextRequest) {
  const startedAt = Date.now();
  let userId: string | null = null;
  let workspaceId: string | null = null;
  let evidenceCount = 0;

  try {
    const authorization = requireBearerToken(request.headers.get("authorization"));
    const supabase = createAuthenticatedSupabase(authorization);
    const user = await getAuthenticatedUser(supabase);
    userId = user.id;

    const body = (await request.json()) as AnalyzeRequestBody;
    workspaceId = body.workspace_id ?? null;
    const question = body.question?.trim();

    if (!workspaceId || workspaceId === "all") {
      return NextResponse.json({ error: "A specific workspace_id is required." }, { status: 400 });
    }
    if (!question) {
      return NextResponse.json({ error: "Question is required." }, { status: 400 });
    }

    const { data: workspace, error: workspaceError } = await supabase
      .from("workspaces")
      .select("id")
      .eq("id", workspaceId)
      .single();

    if (workspaceError || !workspace) {
      return NextResponse.json({ error: "Workspace not found or not owned by this user." }, { status: 403 });
    }

    const queryEmbedding = await createEmbedding(question);
    const { count: embeddedFeedbackCount, error: countError } = await supabase
      .from("feedback_items")
      .select("id", { count: "exact", head: true })
      .eq("workspace_id", workspaceId)
      .not("embedding", "is", null);

    if (countError) throw countError;

    const { data: matches, error: matchError } = await supabase.rpc("match_feedback_items", {
      query_embedding: queryEmbedding,
      match_workspace_id: workspaceId,
      match_count: 10,
      match_threshold: 0.1
    });

    if (matchError) throw matchError;

    const feedbackItems = ((matches ?? []) as MatchFeedbackRow[]).map((item) => ({
      id: item.id,
      source: item.source,
      customer: item.customer,
      title: item.title,
      excerpt: item.excerpt,
      sentiment: item.sentiment,
      theme: item.theme,
      rating: item.rating,
      plan: item.plan,
      similarity: item.similarity
    })) satisfies RagFeedbackItem[];
    evidenceCount = feedbackItems.length;

    if (feedbackItems.length < 3) {
      const weak = buildWeakEvidenceResponse(
        embeddedFeedbackCount
          ? `There is not enough relevant evidence to answer confidently. ${embeddedFeedbackCount} feedback items exist in this workspace, but only ${feedbackItems.length} matched this question.`
          : "No searchable feedback items were found for this workspace. Reimport feedback after checking your analysis service configuration."
      );
      await trackUsage(supabase, userId, "rag_analysis_weak_evidence", {
        workspace_id: workspaceId,
        evidence_count: evidenceCount,
        latency_ms: Date.now() - startedAt
      });
      return NextResponse.json(weak);
    }

    const analysis = await analyzeWithOpenAI({ question, feedbackItems });
    const response: OpenAIAnalysisResponse = {
      ...analysis,
      evidence_count: evidenceCount,
      retrieved_feedback_items: feedbackItems
    };

    await trackUsage(supabase, userId, "rag_analysis_completed", {
      workspace_id: workspaceId,
      evidence_count: evidenceCount,
      enough_evidence: response.enough_evidence,
      latency_ms: Date.now() - startedAt
    });

    return NextResponse.json(response);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to analyze feedback.";

    if (userId) {
      try {
        const authorization = request.headers.get("authorization");
        if (authorization) {
          const supabase = createAuthenticatedSupabase(authorization);
          await trackUsage(supabase, userId, "rag_analysis_failed", {
            workspace_id: workspaceId,
            evidence_count: evidenceCount,
            error: message,
            latency_ms: Date.now() - startedAt
          });
        }
      } catch {
        // Ignore secondary usage logging failures.
      }
    }

    const status = message.includes("Missing Supabase access token") || message.includes("Not authenticated") ? 401 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
