import type { AnalysisResult, FeedbackItem, RetrievedEvidence } from "@/lib/types";

const stopWords = new Set([
  "what",
  "which",
  "should",
  "about",
  "from",
  "with",
  "that",
  "this",
  "there",
  "their",
  "first",
  "have",
  "need",
  "into",
  "customer",
  "customers",
  "feedback",
  "summarize",
  "show"
]);

export function extractKeywords(question: string): string[] {
  const words = question
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, " ")
    .split(/\s+/)
    .map((word) => word.trim())
    .filter((word) => word.length > 2 && !stopWords.has(word));

  return Array.from(new Set(words));
}

export function retrieveFeedback(
  question: string,
  feedbackItems: FeedbackItem[],
  workspaceId: string
): RetrievedEvidence[] {
  const keywords = extractKeywords(question);
  const scopedItems =
    workspaceId === "all"
      ? feedbackItems
      : feedbackItems.filter((item) => item.workspaceId === workspaceId);

  return scopedItems
    .map((item) => scoreItem(item, keywords))
    .filter((result) => result.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 20);
}

export function analyzeRetrievedFeedback(
  question: string,
  retrieved: RetrievedEvidence[]
): AnalysisResult {
  const themeCounts = new Map<string, number>();
  for (const evidence of retrieved) {
    themeCounts.set(evidence.item.theme, (themeCounts.get(evidence.item.theme) ?? 0) + 1);
  }

  const themes = Array.from(themeCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 4)
    .map(([name, count]) => ({
      name,
      count,
      summary: summarizeTheme(name, retrieved.filter((evidence) => evidence.item.theme === name))
    }));

  const quotes = retrieved.slice(0, 4).map((evidence) => ({
    id: evidence.item.id,
    customer: evidence.item.customer,
    quote: evidence.item.excerpt,
    source: evidence.item.source
  }));

  const negativeCount = retrieved.filter((evidence) => evidence.item.sentiment === "negative").length;
  const lowRatingCount = retrieved.filter((evidence) => evidence.item.rating <= 2).length;
  const businessImpactCount = retrieved.filter((evidence) => evidence.item.plan === "Enterprise" || evidence.item.plan === "Business").length;
  const topTheme = themes[0]?.name ?? "the available feedback";
  const priority = estimatePriority(retrieved.length, negativeCount, lowRatingCount, businessImpactCount);

  return {
    id: `analysis-${Date.now()}`,
    question,
    shortAnswer:
      retrieved.length === 0
        ? "No strong local evidence matched this question. Try a broader question or import more feedback."
        : `${topTheme} is the strongest signal across ${retrieved.length} retrieved items. ${negativeCount} items are negative, so this should be reviewed as a product risk before roadmap planning.`,
    priority,
    themes,
    evidenceCount: retrieved.length,
    quotes,
    actions: buildActions(themes, negativeCount),
    retrieved
  };
}

function scoreItem(item: FeedbackItem, keywords: string[]): RetrievedEvidence {
  const text = [
    item.title,
    item.excerpt,
    item.theme,
    item.customer,
    item.source,
    item.sentiment,
    item.plan,
    String(item.rating)
  ]
    .join(" ")
    .toLowerCase();

  const matchedKeywords = keywords.filter((keyword) => text.includes(keyword));
  const score =
    matchedKeywords.length * 3 +
    matchedKeywords.filter((keyword) => item.title.toLowerCase().includes(keyword)).length * 2 +
    matchedKeywords.filter((keyword) => item.theme.toLowerCase().includes(keyword)).length * 2 +
    (item.sentiment === "negative" ? 1 : 0) +
    (item.plan === "Enterprise" || item.plan === "Business" ? 1 : 0);

  return { item, score, matchedKeywords };
}

function summarizeTheme(name: string, retrieved: RetrievedEvidence[]) {
  const sentiments = retrieved.reduce(
    (acc, evidence) => {
      acc[evidence.item.sentiment] += 1;
      return acc;
    },
    { positive: 0, neutral: 0, negative: 0 }
  );

  if (sentiments.negative >= sentiments.positive && sentiments.negative > 0) {
    return `${name} is mostly negative and appears in high-priority customer evidence.`;
  }
  if (sentiments.positive > sentiments.negative) {
    return `${name} is a positive differentiator that can be amplified in product messaging.`;
  }
  return `${name} is mixed or exploratory and needs more segmentation before prioritization.`;
}

function buildActions(themes: AnalysisResult["themes"], negativeCount: number) {
  if (themes.length === 0) {
    return ["Import more feedback or broaden the question before saving this analysis."];
  }

  const topTheme = themes[0].name;
  const actions = [
    `Create a product brief for ${topTheme} with the retrieved evidence attached.`,
    `Review the top ${Math.min(5, themes[0].count)} quotes with design, support, and sales.`,
    `Add a roadmap candidate linked to ${topTheme} if the same signal repeats next week.`
  ];

  if (negativeCount > 5) {
    actions.unshift("Treat this as a retention risk because negative evidence dominates the retrieved set.");
  }

  return actions;
}

function estimatePriority(
  evidenceCount: number,
  negativeCount: number,
  lowRatingCount: number,
  businessImpactCount: number
): AnalysisResult["priority"] {
  if (evidenceCount === 0) {
    return {
      level: "low",
      rationale: "No matching evidence was found, so this should not be prioritized yet.",
      drivers: ["No retrieved evidence"]
    };
  }

  const riskScore = negativeCount * 2 + lowRatingCount * 2 + businessImpactCount;
  if (riskScore >= 8 || (negativeCount >= 3 && businessImpactCount >= 2)) {
    return {
      level: "high",
      rationale: "The matched feedback contains repeated negative or low-rated evidence from commercially important customers.",
      drivers: ["Repeated negative feedback", "Low ratings or customer pain", "Business or Enterprise impact"]
    };
  }

  if (riskScore >= 4 || negativeCount >= 2) {
    return {
      level: "medium",
      rationale: "There is enough customer pain to investigate, but the evidence needs sharper sizing before committing roadmap capacity.",
      drivers: ["Multiple related signals", "Some negative sentiment", "Needs sizing"]
    };
  }

  return {
    level: "low",
    rationale: "The matched evidence is limited or not severe enough to justify immediate prioritization.",
    drivers: ["Limited severity", "Monitor for repeated signal"]
  };
}
