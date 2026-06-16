"use client";

import { MoreHorizontal, Search } from "lucide-react";
import { useMemo, useState } from "react";
import { AppShell } from "@/components/app-shell";
import { PageHeader } from "@/components/page-header";
import { SentimentBadge, StatusBadge } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { Plan, Sentiment } from "@/lib/types";
import { useCustomerSignalState } from "@/lib/use-customer-signal";

export default function FeedbackPage() {
  const { feedbackItems, workspaces, loading, error } = useCustomerSignalState();
  const [searchText, setSearchText] = useState("");
  const [workspace, setWorkspace] = useState("all");
  const [source, setSource] = useState("all");
  const [rating, setRating] = useState("all");
  const [sentiment, setSentiment] = useState("all");
  const [plan, setPlan] = useState("all");

  const sources = useMemo(
    () => Array.from(new Set(feedbackItems.map((item) => item.source))).sort(),
    [feedbackItems]
  );

  const filteredItems = useMemo(() => {
    const query = searchText.toLowerCase().trim();
    return feedbackItems.filter((item) => {
      const haystack = [item.title, item.excerpt, item.customer, item.source, item.theme, item.workspace]
        .join(" ")
        .toLowerCase();
      return (
        (!query || haystack.includes(query)) &&
        (workspace === "all" || item.workspaceId === workspace) &&
        (source === "all" || item.source === source) &&
        (rating === "all" || item.rating === Number(rating)) &&
        (sentiment === "all" || item.sentiment === (sentiment as Sentiment)) &&
        (plan === "all" || item.plan === (plan as Plan))
      );
    });
  }, [feedbackItems, plan, rating, searchText, sentiment, source, workspace]);

  return (
    <AppShell>
      <PageHeader
        title="Feedback Table"
        description="Review customer evidence with source, rating, sentiment, plan, workspace, and search filters."
      />
      {error ? <div className="mb-4 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div> : null}
      <Card>
        <CardContent className="p-4">
          {loading ? (
            <div className="mb-4 rounded-md border bg-muted/30 p-3 text-sm text-muted-foreground">Loading feedback...</div>
          ) : null}
          <div className="mb-4 grid gap-3 lg:grid-cols-[1fr_repeat(5,10rem)]">
            <div className="relative">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                className="pl-9"
                value={searchText}
                onChange={(event) => setSearchText(event.target.value)}
                placeholder="Search feedback, customer, source, or theme"
              />
            </div>
            <Select value={workspace} onValueChange={setWorkspace}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All workspaces</SelectItem>
                {workspaces.map((item) => <SelectItem key={item.id} value={item.id}>{item.name}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={source} onValueChange={setSource}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All sources</SelectItem>
                {sources.map((item) => <SelectItem key={item} value={item}>{item}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={rating} onValueChange={setRating}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All ratings</SelectItem>
                {[5, 4, 3, 2, 1].map((item) => <SelectItem key={item} value={String(item)}>{item} stars</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={sentiment} onValueChange={setSentiment}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All sentiment</SelectItem>
                <SelectItem value="negative">Negative</SelectItem>
                <SelectItem value="neutral">Neutral</SelectItem>
                <SelectItem value="positive">Positive</SelectItem>
              </SelectContent>
            </Select>
            <Select value={plan} onValueChange={setPlan}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All plans</SelectItem>
                {(["Free", "Pro", "Business", "Enterprise"] satisfies Plan[]).map((item) => (
                  <SelectItem key={item} value={item}>{item}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="mb-3 text-sm text-muted-foreground">
            Showing {filteredItems.length.toLocaleString()} of {feedbackItems.length.toLocaleString()} feedback items.
          </div>

          {filteredItems.length ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Feedback</TableHead>
                  <TableHead>Customer</TableHead>
                  <TableHead>Workspace</TableHead>
                  <TableHead>Source</TableHead>
                  <TableHead>Rating</TableHead>
                  <TableHead>Plan</TableHead>
                  <TableHead>Sentiment</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-10"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredItems.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell className="min-w-80">
                      <Dialog>
                        <DialogTrigger className="text-left">
                          <div className="font-medium hover:text-primary">{item.title}</div>
                          <div className="mt-1 line-clamp-2 text-xs text-muted-foreground">{item.excerpt}</div>
                        </DialogTrigger>
                        <DialogContent>
                          <DialogHeader>
                            <DialogTitle>{item.title}</DialogTitle>
                            <DialogDescription>{item.id} · {item.source} · {item.date}</DialogDescription>
                          </DialogHeader>
                          <p className="text-sm leading-6">{item.excerpt}</p>
                          <div className="grid grid-cols-2 gap-3 text-sm">
                            <div className="rounded-md border p-3"><div className="text-muted-foreground">Theme</div><div className="font-medium">{item.theme}</div></div>
                            <div className="rounded-md border p-3"><div className="text-muted-foreground">Revenue</div><div className="font-medium">{item.revenue}</div></div>
                            <div className="rounded-md border p-3"><div className="text-muted-foreground">Plan</div><div className="font-medium">{item.plan}</div></div>
                            <div className="rounded-md border p-3"><div className="text-muted-foreground">Rating</div><div className="font-medium">{item.rating}</div></div>
                          </div>
                        </DialogContent>
                      </Dialog>
                    </TableCell>
                    <TableCell>{item.customer}</TableCell>
                    <TableCell>{item.workspace}</TableCell>
                    <TableCell>{item.source}</TableCell>
                    <TableCell>{item.rating}</TableCell>
                    <TableCell>{item.plan}</TableCell>
                    <TableCell><SentimentBadge sentiment={item.sentiment} /></TableCell>
                    <TableCell><StatusBadge status={item.status} /></TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon"><MoreHorizontal className="h-4 w-4" /></Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem>Open evidence</DropdownMenuItem>
                          <DropdownMenuItem>Add to report</DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem>Mark as planned</DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <div className="flex min-h-72 items-center justify-center rounded-md border bg-muted/30 p-6 text-center">
              <div>
                <div className="font-medium">{feedbackItems.length ? "No feedback matches these filters" : "No feedback yet"}</div>
                <p className="mt-1 text-sm text-muted-foreground">
                  {feedbackItems.length ? "Clear filters or import more feedback." : "Create a workspace, then import pasted notes or upload a CSV."}
                </p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </AppShell>
  );
}
