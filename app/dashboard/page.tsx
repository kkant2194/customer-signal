"use client";

import {
  AlertTriangle,
  BarChart3,
  FileText,
  MessageSquare,
  PieChart,
  SearchCheck,
  TrendingDown
} from "lucide-react";
import { useMemo, useState } from "react";
import { AppShell } from "@/components/app-shell";
import { PageHeader } from "@/components/page-header";
import { SentimentBadge, StatusBadge } from "@/components/status-badge";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { FeedbackItem } from "@/lib/types";
import { useCustomerSignalState } from "@/lib/use-customer-signal";

export default function DashboardPage() {
  const { workspaces, feedbackItems, savedReports, loading, error } = useCustomerSignalState();
  const [workspaceId, setWorkspaceId] = useState("all");

  const scopedFeedback = useMemo(
    () => workspaceId === "all" ? feedbackItems : feedbackItems.filter((item) => item.workspaceId === workspaceId),
    [feedbackItems, workspaceId]
  );
  const scopedReports = useMemo(
    () => workspaceId === "all" ? savedReports : savedReports.filter((report) => report.workspaceId === workspaceId),
    [savedReports, workspaceId]
  );

  const total = scopedFeedback.length;
  const negativeItems = scopedFeedback.filter((item) => item.sentiment === "negative");
  const riskItems = negativeItems
    .filter((item) => item.status !== "closed")
    .sort((a, b) => riskScore(b) - riskScore(a))
    .slice(0, 6);
  const averageRating = total
    ? (scopedFeedback.reduce((sum, item) => sum + item.rating, 0) / total).toFixed(1)
    : "0.0";
  const negativeShare = total ? Math.round((negativeItems.length / total) * 100) : 0;
  const sourceCount = new Set(scopedFeedback.map((item) => item.source)).size;
  const themeRows = topCounts(scopedFeedback.map((item) => item.theme), 5);
  const sourceRows = topCounts(scopedFeedback.map((item) => item.source), 5).map(([source, count]) => {
    const items = scopedFeedback.filter((item) => item.source === source);
    const negative = items.filter((item) => item.sentiment === "negative").length;
    return { source, count, negativeShare: count ? Math.round((negative / count) * 100) : 0 };
  });
  const topThemeCount = themeRows[0]?.[1] ?? 0;

  const metrics = [
    {
      label: "Feedback records",
      value: total.toLocaleString(),
      detail: `${sourceCount} active sources`,
      icon: MessageSquare,
      variant: "info" as const
    },
    {
      label: "Open risks",
      value: riskItems.length.toLocaleString(),
      detail: `${negativeShare}% negative signal mix`,
      icon: AlertTriangle,
      variant: riskItems.length ? "danger" as const : "success" as const
    },
    {
      label: "Average rating",
      value: averageRating,
      detail: total ? "across imported evidence" : "no ratings yet",
      icon: BarChart3,
      variant: "secondary" as const
    },
    {
      label: "Saved reports",
      value: scopedReports.length.toLocaleString(),
      detail: "research readouts",
      icon: FileText,
      variant: "success" as const
    }
  ];

  return (
    <AppShell>
      <PageHeader
        title="Dashboard"
        description="A workspace-level operating view of customer evidence, risk, and product themes."
        actions={
          <Select value={workspaceId} onValueChange={setWorkspaceId}>
            <SelectTrigger className="w-56">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All workspaces</SelectItem>
              {workspaces.map((workspace) => (
                <SelectItem key={workspace.id} value={workspace.id}>{workspace.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        }
      />

      {error ? <div className="mb-4 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div> : null}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {metrics.map((metric) => {
          const Icon = metric.icon;
          return (
            <Card key={metric.label}>
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm text-muted-foreground">{metric.label}</p>
                    <div className="mt-2 text-2xl font-semibold tracking-tight">{loading ? "..." : metric.value}</div>
                    <p className="mt-2 truncate text-xs text-muted-foreground">{metric.detail}</p>
                  </div>
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-slate-100 text-slate-700">
                    <Icon className="h-4 w-4" />
                  </div>
                </div>
                <div className="mt-3">
                  <Badge variant={metric.variant}>{metric.label === "Open risks" && !riskItems.length ? "Clear" : "Live"}</Badge>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <div className="mt-5 grid gap-5 xl:grid-cols-[1.2fr_0.8fr]">
        <Card>
          <CardHeader className="flex-row items-center justify-between gap-4">
            <div className="min-w-0">
              <CardTitle>Risk queue</CardTitle>
              <CardDescription>Negative unresolved signals ranked by customer plan and rating.</CardDescription>
            </div>
            <Badge variant={riskItems.length ? "danger" : "success"}>{riskItems.length} open</Badge>
          </CardHeader>
          <CardContent>
            {loading ? (
              <DashboardSkeleton />
            ) : riskItems.length ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Signal</TableHead>
                    <TableHead>Customer</TableHead>
                    <TableHead>Plan</TableHead>
                    <TableHead>Rating</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {riskItems.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell className="min-w-80">
                        <div className="font-medium">{item.title}</div>
                        <div className="mt-1 line-clamp-2 text-xs text-muted-foreground">{item.excerpt}</div>
                      </TableCell>
                      <TableCell>{item.customer}</TableCell>
                      <TableCell>{item.plan}</TableCell>
                      <TableCell>{item.rating}</TableCell>
                      <TableCell><StatusBadge status={item.status} /></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <EmptyPanel
                icon={SearchCheck}
                title={total ? "No open negative risks" : "No feedback imported yet"}
                description={total ? "Negative feedback is either closed or absent in this workspace." : "Import feedback to populate risk, theme, and source intelligence."}
              />
            )}
          </CardContent>
        </Card>

        <div className="grid gap-5">
          <Card>
            <CardHeader>
              <CardTitle>Theme concentration</CardTitle>
              <CardDescription>Most repeated product areas in this workspace.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {themeRows.length ? themeRows.map(([theme, count]) => (
                <SignalBar
                  key={theme}
                  label={theme}
                  value={`${count} mentions`}
                  percent={topThemeCount ? Math.round((count / topThemeCount) * 100) : 0}
                />
              )) : (
                <EmptyPanel icon={PieChart} title="No themes yet" description="Themes appear after feedback is imported." compact />
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Source health</CardTitle>
              <CardDescription>Where the strongest signals are coming from.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {sourceRows.length ? sourceRows.map((row) => (
                <div key={row.source} className="rounded-md border border-slate-100 bg-slate-50/70 p-3">
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <div className="truncate text-sm font-medium">{row.source}</div>
                      <div className="text-xs text-muted-foreground">{row.count} feedback records</div>
                    </div>
                    <Badge variant={row.negativeShare >= 40 ? "danger" : row.negativeShare >= 20 ? "warning" : "success"}>
                      {row.negativeShare}% negative
                    </Badge>
                  </div>
                </div>
              )) : (
                <EmptyPanel icon={TrendingDown} title="No source data" description="Source health appears after import." compact />
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      <Card className="mt-5">
        <CardHeader className="flex-row items-center justify-between gap-4">
          <div>
            <CardTitle>Recent evidence</CardTitle>
            <CardDescription>Latest imported feedback for the selected scope.</CardDescription>
          </div>
          <Badge variant="secondary">{scopedFeedback.slice(0, 8).length} shown</Badge>
        </CardHeader>
        <CardContent>
          {scopedFeedback.length ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Feedback</TableHead>
                  <TableHead>Workspace</TableHead>
                  <TableHead>Source</TableHead>
                  <TableHead>Theme</TableHead>
                  <TableHead>Sentiment</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {scopedFeedback.slice(0, 8).map((item) => (
                  <TableRow key={item.id}>
                    <TableCell className="min-w-96">
                      <div className="font-medium">{item.title}</div>
                      <div className="mt-1 line-clamp-2 text-xs text-muted-foreground">{item.excerpt}</div>
                    </TableCell>
                    <TableCell>{item.workspace}</TableCell>
                    <TableCell>{item.source}</TableCell>
                    <TableCell>{item.theme}</TableCell>
                    <TableCell><SentimentBadge sentiment={item.sentiment} /></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <EmptyPanel icon={MessageSquare} title="No evidence in this scope" description="Choose another workspace or import feedback." />
          )}
        </CardContent>
      </Card>
    </AppShell>
  );
}

function topCounts(values: string[], limit: number): Array<[string, number]> {
  const counts = values.reduce<Record<string, number>>((acc, value) => {
    acc[value] = (acc[value] ?? 0) + 1;
    return acc;
  }, {});

  return Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, limit);
}

function riskScore(item: FeedbackItem) {
  const planWeight = item.plan === "Enterprise" ? 5 : item.plan === "Business" ? 3 : item.plan === "Pro" ? 2 : 1;
  return planWeight * 10 + (6 - item.rating);
}

function SignalBar({ label, value, percent }: { label: string; value: string; percent: number }) {
  return (
    <div>
      <div className="mb-1 flex items-center justify-between gap-3 text-sm">
        <span className="min-w-0 truncate font-medium">{label}</span>
        <span className="shrink-0 text-xs text-muted-foreground">{value}</span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-slate-100">
        <div className="h-full rounded-full bg-primary" style={{ width: `${Math.max(percent, 8)}%` }} />
      </div>
    </div>
  );
}

function DashboardSkeleton() {
  return (
    <div className="space-y-3">
      <Skeleton className="h-12 w-full" />
      <Skeleton className="h-12 w-full" />
      <Skeleton className="h-12 w-full" />
    </div>
  );
}

function EmptyPanel({
  icon: Icon,
  title,
  description,
  compact
}: {
  icon: typeof MessageSquare;
  title: string;
  description: string;
  compact?: boolean;
}) {
  return (
    <div className={`flex ${compact ? "min-h-32" : "min-h-56"} flex-col items-center justify-center rounded-md border border-dashed bg-slate-50/70 p-6 text-center`}>
      <Icon className="h-7 w-7 text-muted-foreground" />
      <div className="mt-3 font-medium">{title}</div>
      <p className="mt-1 max-w-sm text-sm text-muted-foreground">{description}</p>
    </div>
  );
}
