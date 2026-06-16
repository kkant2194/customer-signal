import { NextRequest, NextResponse } from "next/server";
import { createEmbedding } from "@/lib/server/openai";
import {
  createAuthenticatedSupabase,
  getAuthenticatedUser,
  requireBearerToken,
  trackUsage
} from "@/lib/server/supabase";
import type { FeedbackStatus, ImportFeedbackRequestRow, Plan } from "@/lib/types";

export const runtime = "nodejs";

interface ImportFeedbackRequestBody {
  workspace_id?: string;
  rows?: ImportFeedbackRequestRow[];
}

export async function POST(request: NextRequest) {
  const startedAt = Date.now();
  let userId: string | null = null;
  let workspaceId: string | null = null;
  let rowCount = 0;

  try {
    const authorization = requireBearerToken(request.headers.get("authorization"));
    const supabase = createAuthenticatedSupabase(authorization);
    const user = await getAuthenticatedUser(supabase);
    userId = user.id;

    const body = (await request.json()) as ImportFeedbackRequestBody;
    workspaceId = body.workspace_id ?? null;
    const rows = (body.rows ?? []).slice(0, 100);
    rowCount = rows.length;

    if (!workspaceId) {
      return NextResponse.json({ error: "workspace_id is required." }, { status: 400 });
    }
    if (!rows.length) {
      return NextResponse.json({ error: "At least one feedback row is required." }, { status: 400 });
    }

    const { data: workspace, error: workspaceError } = await supabase
      .from("workspaces")
      .select("id")
      .eq("id", workspaceId)
      .single();

    if (workspaceError || !workspace) {
      return NextResponse.json({ error: "Workspace not found or not owned by this user." }, { status: 403 });
    }

    const embeddedRows = [];
    for (let index = 0; index < rows.length; index += 10) {
      const batch = rows.slice(index, index + 10);
      const embeddedBatch = await Promise.all(batch.map(async (row) => {
        const feedback = row.feedback.trim();
        const title = row.title?.trim() || feedback.slice(0, 84) || "Imported feedback";
        const theme = inferTheme(feedback);
        const metadata = sanitizeMetadata(row.metadata);
        const embedding = await createEmbedding(
          [
            title,
            feedback,
            row.customer,
            row.source,
            row.sentiment,
            row.plan,
            String(row.rating),
            theme,
            JSON.stringify(metadata)
          ].join("\n")
        );

        return {
          user_id: user.id,
          workspace_id: workspaceId,
          source: row.source || "Imported",
          customer: row.customer || "Unknown customer",
          title,
          excerpt: feedback,
          sentiment: row.sentiment,
          theme,
          status: "new" satisfies FeedbackStatus,
          revenue: revenueForPlan(row.plan),
          rating: row.rating,
          plan: row.plan,
          feedback_date: new Date().toISOString().slice(0, 10),
          metadata,
          embedding
        };
      }));
      embeddedRows.push(...embeddedBatch);
    }

    const { error: insertError } = await supabase.from("feedback_items").insert(embeddedRows);
    if (insertError) throw insertError;

    await trackUsage(supabase, user.id, "rag_feedback_imported", {
      workspace_id: workspaceId,
      row_count: rowCount,
      embedding_model: process.env.OPENAI_EMBEDDING_MODEL ?? "text-embedding-3-small",
      latency_ms: Date.now() - startedAt
    });

    return NextResponse.json({ imported_count: rowCount });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to import feedback.";

    if (userId) {
      try {
        const authorization = request.headers.get("authorization");
        if (authorization) {
          const supabase = createAuthenticatedSupabase(authorization);
          await trackUsage(supabase, userId, "rag_feedback_import_failed", {
            workspace_id: workspaceId,
            row_count: rowCount,
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

function sanitizeMetadata(metadata: Record<string, unknown> | undefined) {
  if (!metadata) return {};
  return Object.fromEntries(
    Object.entries(metadata)
      .filter(([key, value]) => key.length < 120 && value !== undefined && value !== null)
      .map(([key, value]) => [key, typeof value === "object" ? JSON.stringify(value) : value])
  );
}

function revenueForPlan(plan: Plan) {
  if (plan === "Enterprise") return "$124k";
  if (plan === "Business") return "$72k";
  if (plan === "Pro") return "$18k";
  return "$0";
}

function inferTheme(text: string) {
  const lower = text.toLowerCase();
  if (lower.includes("onboard") || lower.includes("activation") || lower.includes("checklist")) return "Onboarding friction";
  if (lower.includes("report") || lower.includes("evidence") || lower.includes("executive")) return "Reporting confidence";
  if (lower.includes("import") || lower.includes("csv") || lower.includes("upload")) return "Import reliability";
  if (lower.includes("permission") || lower.includes("role") || lower.includes("admin")) return "Admin controls";
  if (lower.includes("notification") || lower.includes("alert")) return "Notification controls";
  return "Uncategorized feedback";
}
