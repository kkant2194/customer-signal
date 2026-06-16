"use client";

import { Bot, CheckCircle2, ClipboardList, Quote, Save, SearchCheck, Target } from "lucide-react";
import { useMemo, useState } from "react";
import { AppShell } from "@/components/app-shell";
import { PageHeader } from "@/components/page-header";
import { useToast } from "@/components/toast-provider";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { getSupabaseClient } from "@/lib/supabase/client";
import { saveAnalysisReport } from "@/lib/supabase-store";
import { analyzeRetrievedFeedback, extractKeywords, retrieveFeedback } from "@/lib/retrieval";
import type { AnalysisResult, FeedbackItem, OpenAIAnalysisResponse, RetrievedEvidence } from "@/lib/types";
import { useCustomerSignalState } from "@/lib/use-customer-signal";

const fallbackQuestion = "What are the highest-priority product risks in this workspace?";

export default function AskAiPage() {
  const { toast } = useToast();
  const { workspaces, feedbackItems, loading, error, refresh } = useCustomerSignalState();
  const [workspaceId, setWorkspaceId] = useState("all");
  const [question, setQuestion] = useState(fallbackQuestion);
  const [analysis, setAnalysis] = useState<AnalysisResult>(() =>
    analyzeRetrievedFeedback(fallbackQuestion, retrieveFeedback(fallbackQuestion, feedbackItems, "all"))
  );
  const [saveMessage, setSaveMessage] = useState("");
  const [saving, setSaving] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);

  const keywords = useMemo(() => extractKeywords(question), [question]);
  const effectiveWorkspaceId = workspaceId === "all" ? workspaces[0]?.id ?? "" : workspaceId;
  const selectedWorkspace = workspaces.find((workspace) => workspace.id === effectiveWorkspaceId);
  const scopedFeedback = useMemo(
    () => feedbackItems.filter((item) => item.workspaceId === effectiveWorkspaceId),
    [feedbackItems, effectiveWorkspaceId]
  );
  const promptSuggestions = useMemo(() => buildPromptSuggestions(scopedFeedback), [scopedFeedback]);

  async function handleAnalyze() {
    if (!effectiveWorkspaceId) {
      toast({ title: "Select a workspace", description: "Create or select a workspace before analyzing feedback.", variant: "error" });
      return;
    }

    setAnalyzing(true);
    setSaveMessage("");
    try {
      const supabase = getSupabaseClient();
      const { data } = supabase ? await supabase.auth.getSession() : { data: { session: null } };
      const accessToken = data.session?.access_token;
      if (!accessToken) {
        throw new Error("You must be logged in before analyzing feedback.");
      }

      const response = await fetch("/api/analyze-feedback", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`
        },
        body: JSON.stringify({
          workspace_id: effectiveWorkspaceId,
          question
        })
      });

      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.error ?? "Analysis failed.");
      }

      setAnalysis(mapOpenAIAnalysis(question, payload as OpenAIAnalysisResponse));
      toast({ title: "Analysis complete", description: "Relevant feedback was analyzed successfully.", variant: "success" });
    } catch (nextError) {
      toast({
        title: "Analysis failed",
        description: nextError instanceof Error ? nextError.message : "Try again.",
        variant: "error"
      });
    } finally {
      setAnalyzing(false);
    }
  }

  async function handleSaveReport() {
    const workspace = selectedWorkspace ?? workspaces[0];
    setSaving(true);
    try {
      await saveAnalysisReport({
        id: `RPT-${Date.now()}`,
        name: question.slice(0, 72),
        workspaceId: selectedWorkspace?.id ?? "all",
        workspace: selectedWorkspace?.name ?? "All workspaces",
        type: "AI analysis",
        status: "Ready",
        updated: "Today",
        owner: workspace?.owner ?? "Product team",
        question,
        answer: analysis.shortAnswer,
        evidenceCount: analysis.evidenceCount,
        themes: analysis.themes,
        quotes: analysis.quotes,
        actions: analysis.actions
      });
      await refresh();
      setSaveMessage("Analysis saved to reports.");
      toast({ title: "Report saved", description: "The analysis is now available in saved reports.", variant: "success" });
    } catch (nextError) {
      toast({
        title: "Could not save report",
        description: nextError instanceof Error ? nextError.message : "Try again.",
        variant: "error"
      });
    } finally {
      setSaving(false);
    }
  }

  return (
    <AppShell>
      <PageHeader
        title="Ask AI"
        description="Ask focused product questions and get answers grounded in matching customer feedback."
      />
      {error ? <div className="mb-4 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div> : null}
      <div className="grid gap-5 xl:grid-cols-[0.9fr_1.1fr]">
        <div className="space-y-5">
          <Card>
            <CardHeader>
              <CardTitle>Research question</CardTitle>
            <CardDescription>Select a workspace, ask a product question, and analyze only the most relevant feedback.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {workspaces.length ? (
              <Select value={effectiveWorkspaceId} onValueChange={setWorkspaceId} disabled={loading || analyzing}>
                <SelectTrigger><SelectValue placeholder="Select workspace" /></SelectTrigger>
                <SelectContent>
                  {workspaces.map((workspace) => (
                    <SelectItem key={workspace.id} value={workspace.id}>{workspace.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              ) : (
                <div className="rounded-md border bg-muted/30 p-3 text-sm text-muted-foreground">
                  Create a workspace and import feedback before asking AI.
                </div>
              )}
              <Textarea className="min-h-32" value={question} onChange={(event) => setQuestion(event.target.value)} />
              <div className="flex flex-wrap gap-2">
                {promptSuggestions.map((example) => (
                  <Button key={example} variant="outline" size="sm" onClick={() => setQuestion(example)}>{example}</Button>
                ))}
              </div>
              <div className="flex flex-wrap gap-2">
                {keywords.length ? keywords.map((keyword) => (
                  <Badge key={keyword} variant="secondary">{keyword}</Badge>
                )) : <span className="text-sm text-muted-foreground">Keywords will appear here.</span>}
              </div>
              <Button className="w-full" disabled={loading || analyzing || !feedbackItems.length || !effectiveWorkspaceId} onClick={() => void handleAnalyze()}>
                <Bot className="h-4 w-4" /> {analyzing ? "Analyzing feedback..." : "Analyze feedback"}
              </Button>
              {!feedbackItems.length ? (
                <div className="rounded-md border bg-muted/30 p-3 text-sm text-muted-foreground">
                  Import feedback before running analysis.
                </div>
              ) : null}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Retrieved evidence</CardTitle>
              <CardDescription>Top {analysis.retrieved.length} relevant feedback matches.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {analysis.retrieved.length ? analysis.retrieved.map((evidence) => (
                <div key={evidence.item.id} className="rounded-md border p-3">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="text-sm font-medium">{evidence.item.title}</div>
                      <div className="mt-1 text-xs text-muted-foreground">{evidence.item.id} · {evidence.item.source} · {evidence.item.customer}</div>
                    </div>
                    <Badge variant="info">similarity {evidence.score.toFixed(2)}</Badge>
                  </div>
                  <div className="mt-2 flex flex-wrap gap-1">
                    {evidence.matchedKeywords.map((keyword) => (
                      <Badge key={keyword} variant="outline">{keyword}</Badge>
                    ))}
                  </div>
                </div>
              )) : (
                <div className="rounded-md border bg-muted/30 p-4 text-sm text-muted-foreground">
                  No evidence matched. Try a broader question or import more feedback.
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <CardTitle>Structured answer</CardTitle>
              <CardDescription>{analysis.evidenceCount} evidence items included in this analysis.</CardDescription>
              </div>
              <div className="flex items-center gap-2">
                {saveMessage ? <Badge variant="success">{saveMessage}</Badge> : null}
                <Button size="sm" disabled={!analysis.evidenceCount || saving} onClick={() => void handleSaveReport()}>
                  <Save className="h-4 w-4" /> {saving ? "Saving..." : "Save report"}
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="rounded-lg border bg-muted/30 p-4">
              <div className="mb-2 flex items-center gap-2 text-sm font-medium">
                <SearchCheck className="h-4 w-4" /> Short answer
              </div>
              <p className="text-sm leading-6 text-muted-foreground">{analysis.shortAnswer}</p>
            </div>
            {analysis.priority ? (
              <div className="rounded-lg border p-4">
                <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2 text-sm font-medium">
                    <Target className="h-4 w-4" /> Priority recommendation
                  </div>
                  <Badge variant={getPriorityBadgeVariant(analysis.priority.level)}>
                    {analysis.priority.level} priority
                  </Badge>
                </div>
                <p className="text-sm leading-6 text-muted-foreground">{analysis.priority.rationale}</p>
                {analysis.priority.drivers.length ? (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {analysis.priority.drivers.map((driver) => (
                      <Badge key={driver} variant="outline">{driver}</Badge>
                    ))}
                  </div>
                ) : null}
              </div>
            ) : null}
            <section>
              <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold"><ClipboardList className="h-4 w-4" /> Themes</h3>
              <div className="space-y-3">
                {analysis.themes.map((theme) => (
                  <div key={theme.name} className="rounded-md border p-3">
                    <div className="flex items-center justify-between gap-2">
                      <div className="font-medium">{theme.name}</div>
                      <Badge variant="secondary">{theme.count} evidence items</Badge>
                    </div>
                    <p className="mt-2 text-sm text-muted-foreground">{theme.summary}</p>
                  </div>
                ))}
              </div>
            </section>
            <section>
              <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold"><Quote className="h-4 w-4" /> Direct quotes</h3>
              <div className="grid gap-3 md:grid-cols-2">
                {analysis.quotes.map((quote) => (
                  <blockquote key={quote.id} className="rounded-md border p-3 text-sm">
                    <p className="leading-6">&ldquo;{quote.quote}&rdquo;</p>
                    <footer className="mt-2 text-xs text-muted-foreground">{quote.id} · {quote.customer} · {quote.source}</footer>
                  </blockquote>
                ))}
              </div>
            </section>
            <section>
              <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold"><CheckCircle2 className="h-4 w-4" /> Recommended actions</h3>
              <div className="space-y-2">
                {analysis.actions.map((action) => (
                  <div key={action} className="flex gap-2 rounded-md bg-muted/40 p-3 text-sm">
                    <CheckCircle2 className="mt-0.5 h-4 w-4 text-emerald-600" />
                    <span>{action}</span>
                  </div>
                ))}
              </div>
            </section>
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}

function mapOpenAIAnalysis(question: string, response: OpenAIAnalysisResponse): AnalysisResult {
  const retrieved = (response.retrieved_feedback_items ?? []).filter((item) => item.similarity >= 0.1).map((item) => ({
    item: {
      id: item.id,
      workspaceId: "",
      workspace: "",
      source: item.source,
      customer: item.customer,
      title: item.title,
      excerpt: item.excerpt,
      sentiment: item.sentiment,
      theme: item.theme,
      status: "new" as const,
      date: "",
      revenue: "",
      rating: item.rating,
      plan: item.plan
    },
    score: item.similarity,
    matchedKeywords: []
  })) satisfies RetrievedEvidence[];

  return {
    id: `analysis-${Date.now()}`,
    question,
    shortAnswer: response.short_answer,
    priority: response.priority_summary,
    evidenceCount: response.evidence_count,
    enoughEvidence: response.enough_evidence,
    retrieved,
    themes: response.themes.map((theme) => ({
      name: theme.title ?? theme.name ?? "Feedback theme",
      count: theme.evidence_count,
      summary: theme.summary
    })),
    quotes: response.quotes.map((quote) => ({
      id: quote.source_id,
      customer: quote.customer,
      quote: quote.quote,
      source: retrieved.find((evidence) => evidence.item.id === quote.source_id)?.item.source ?? "Feedback"
    })),
    actions: response.recommended_actions
  };
}

function buildPromptSuggestions(feedbackItems: FeedbackItem[]) {
  if (!feedbackItems.length) {
    return [
      fallbackQuestion,
      "Which themes have the strongest evidence and what should we do next?",
      "What should we prioritize based on negative or low-rated feedback?"
    ];
  }

  const negativeItems = feedbackItems.filter((item) => item.sentiment === "negative" || item.rating <= 2);
  const businessItems = feedbackItems.filter((item) => item.plan === "Enterprise" || item.plan === "Business");
  const topTheme = getTopTheme(negativeItems.length ? negativeItems : feedbackItems);
  const topSource = getTopSource(negativeItems.length ? negativeItems : feedbackItems);

  const suggestions = [
    topTheme ? `What should we prioritize to reduce "${topTheme}" issues?` : fallbackQuestion,
    businessItems.length
      ? "Which Business or Enterprise customer issues create the highest retention risk?"
      : "Which customer problems create the highest activation or retention risk?",
    topSource ? `What actions should we take based on low-rated feedback from ${topSource}?` : "What should we do about the lowest-rated feedback?",
    topTheme ? `What evidence supports prioritizing "${topTheme}" on the roadmap?` : "Which themes have the strongest evidence and what should we do next?"
  ];

  return Array.from(new Set(suggestions)).slice(0, 4);
}

function getTopTheme(feedbackItems: FeedbackItem[]) {
  return getTopValue(feedbackItems.map((item) => item.theme).filter(Boolean));
}

function getTopSource(feedbackItems: FeedbackItem[]) {
  return getTopValue(feedbackItems.map((item) => item.source).filter(Boolean));
}

function getTopValue(values: string[]) {
  const counts = new Map<string, number>();
  for (const value of values) {
    counts.set(value, (counts.get(value) ?? 0) + 1);
  }
  return Array.from(counts.entries()).sort((a, b) => b[1] - a[1])[0]?.[0];
}

function getPriorityBadgeVariant(level: NonNullable<AnalysisResult["priority"]>["level"]) {
  if (level === "high") return "danger";
  if (level === "medium") return "warning";
  return "success";
}
