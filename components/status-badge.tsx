import { Badge } from "@/components/ui/badge";
import type { FeedbackStatus, Sentiment } from "@/lib/types";

export function SentimentBadge({ sentiment }: { sentiment: Sentiment }) {
  const variant =
    sentiment === "positive" ? "success" : sentiment === "negative" ? "danger" : "warning";
  return <Badge variant={variant}>{sentiment}</Badge>;
}

export function StatusBadge({ status }: { status: FeedbackStatus | string }) {
  const variant =
    status === "closed" || status === "Ready" || status === "Active"
      ? "success"
      : status === "planned" || status === "Scheduled" || status === "Reviewing"
        ? "info"
        : status === "triaged" || status === "Draft"
          ? "warning"
          : "secondary";
  return <Badge variant={variant}>{status}</Badge>;
}
