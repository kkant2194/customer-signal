"use client";

import Papa from "papaparse";
import type { ImportPreviewRow, Plan, Rating, Sentiment } from "@/lib/types";

export type RawImportRow = Record<string, string | number | boolean | null | undefined>;

export interface ColumnMapping {
  feedback?: string;
  title?: string;
  customer?: string;
  source?: string;
  rating?: string;
  sentiment?: string;
  plan?: string;
}

export interface ParsedCsvImport {
  kind: "known_csv" | "unknown_csv";
  confidence: number;
  columns: string[];
  rows: RawImportRow[];
  suggestedMapping: ColumnMapping;
  previewRows: ImportPreviewRow[];
}

const fieldAliases: Record<keyof ColumnMapping, string[]> = {
  feedback: ["feedback", "review", "review_body", "body", "comment", "comments", "text", "message", "note", "notes", "excerpt", "description"],
  title: ["title", "review_title", "summary", "subject", "headline"],
  customer: ["customer", "account", "company", "author", "user", "username", "reviewer", "name", "customer_name"],
  source: ["source", "channel", "origin", "platform", "marketplace", "app", "store"],
  rating: ["rating", "stars", "star_rating", "score", "nps"],
  sentiment: ["sentiment", "tone", "polarity"],
  plan: ["plan", "tier", "package", "subscription"]
};

export function parsePastedFeedback(text: string): ImportPreviewRow[] {
  return text
    .split(/\n{2,}|\r?\n-/)
    .map((chunk) => chunk.trim().replace(/^-/, "").trim())
    .filter(Boolean)
    .map((chunk) => {
      const [possibleCustomer, ...rest] = chunk.split(":");
      const hasCustomerPrefix = rest.length > 0 && possibleCustomer.length < 80;
      const feedback = hasCustomerPrefix ? rest.join(":").trim() : chunk;

      return normalizeImportRow(
        {
          source: "Pasted notes",
          customer: hasCustomerPrefix ? possibleCustomer.trim() : "Unknown customer",
          feedback
        },
        { feedback: "feedback", customer: "customer", source: "source" }
      );
    });
}

export function parseCsvFile(file: File): Promise<ParsedCsvImport> {
  return new Promise((resolve, reject) => {
    Papa.parse<RawImportRow>(file, {
      header: true,
      skipEmptyLines: true,
      dynamicTyping: true,
      complete: (result) => {
        const rows = result.data.filter((row) => Object.values(row).some((value) => String(value ?? "").trim()));
        const columns = result.meta.fields ?? collectColumns(rows);
        const suggestedMapping = suggestColumnMapping(columns);
        const previewRows = normalizeRows(rows, suggestedMapping);
        const hasFeedback = Boolean(suggestedMapping.feedback);
        const mappedFieldCount = Object.values(suggestedMapping).filter(Boolean).length;

        resolve({
          kind: hasFeedback && mappedFieldCount >= 3 ? "known_csv" : "unknown_csv",
          confidence: columns.length ? mappedFieldCount / Math.min(columns.length, Object.keys(fieldAliases).length) : 0,
          columns,
          rows,
          suggestedMapping,
          previewRows
        });
      },
      error: (error) => reject(error)
    });
  });
}

export function normalizeRows(rows: RawImportRow[], mapping: ColumnMapping): ImportPreviewRow[] {
  return rows
    .map((row) => normalizeImportRow(row, mapping))
    .filter((row) => row.feedback);
}

export function normalizeImportRow(row: RawImportRow, mapping: ColumnMapping): ImportPreviewRow {
  const feedback = valueFor(row, mapping.feedback).trim();
  const title = valueFor(row, mapping.title).trim();
  const source = valueFor(row, mapping.source).trim() || inferSource(row);
  const customer = valueFor(row, mapping.customer).trim() || "Unknown customer";
  const metadata = buildMetadata(row, mapping);
  const sentiment = normalizeSentiment(valueFor(row, mapping.sentiment), feedback, rawValueFor(row, mapping.rating));

  return {
    source,
    customer,
    title: title || undefined,
    feedback,
    sentiment,
    rating: normalizeRating(rawValueFor(row, mapping.rating), sentiment),
    plan: normalizePlan(valueFor(row, mapping.plan)),
    metadata
  };
}

export function suggestColumnMapping(columns: string[]): ColumnMapping {
  return (Object.keys(fieldAliases) as Array<keyof ColumnMapping>).reduce<ColumnMapping>((mapping, field) => {
    const match = columns.find((column) => fieldAliases[field].includes(normalizeColumnName(column)));
    if (match) mapping[field] = match;
    return mapping;
  }, {});
}

function buildMetadata(row: RawImportRow, mapping: ColumnMapping) {
  const mappedColumns = new Set(Object.values(mapping).filter(Boolean));
  return Object.fromEntries(
    Object.entries(row)
      .filter(([key, value]) => !mappedColumns.has(key) && value !== null && value !== undefined && String(value).trim() !== "")
      .map(([key, value]) => [key, value])
  );
}

function valueFor(row: RawImportRow, column: string | undefined) {
  const value = rawValueFor(row, column);
  return value === null || value === undefined ? "" : String(value);
}

function rawValueFor(row: RawImportRow, column: string | undefined) {
  if (!column) return undefined;
  return row[column];
}

function inferSource(row: RawImportRow) {
  const marketplace = String(row.marketplace ?? row.platform ?? row.store ?? "").trim();
  if (marketplace) return marketplace;
  return "CSV";
}

function collectColumns(rows: RawImportRow[]) {
  return Array.from(new Set(rows.flatMap((row) => Object.keys(row))));
}

function normalizeColumnName(column: string) {
  return column.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
}

function normalizeSentiment(
  value: string,
  feedbackText = "",
  ratingValue?: string | number | boolean | null
): Sentiment {
  const lower = value.toLowerCase();
  if (lower.includes("pos") || lower.includes("happy") || lower.includes("good")) return "positive";
  if (lower.includes("neg") || lower.includes("bad") || lower.includes("poor")) return "negative";
  if (lower.includes("neu") || lower.includes("mixed")) return "neutral";

  const rating = Number(ratingValue);
  if ([1, 2].includes(rating)) return "negative";
  if ([4, 5].includes(rating)) return "positive";

  return inferSentimentFromText(feedbackText);
}

function inferSentimentFromText(text: string): Sentiment {
  const lower = text.toLowerCase();
  const negativeSignals = [
    "blocked",
    "blocker",
    "confusing",
    "crashed",
    "difficult",
    "failed",
    "frustrating",
    "hard",
    "issue",
    "missing",
    "not trust",
    "pain",
    "problem",
    "slow",
    "worried",
    "wrong"
  ];
  const positiveSignals = [
    "confident",
    "easy",
    "excellent",
    "faster",
    "great",
    "helpful",
    "like",
    "liked",
    "love",
    "saves me time",
    "useful",
    "works"
  ];

  const negativeScore = negativeSignals.filter((signal) => lower.includes(signal)).length;
  const positiveScore = positiveSignals.filter((signal) => lower.includes(signal)).length;

  if (negativeScore > positiveScore) return "negative";
  if (positiveScore > negativeScore) return "positive";
  return "neutral";
}

function normalizeRating(value: string | number | boolean | null | undefined, sentiment: Sentiment): Rating {
  const numberValue = Number(value);
  if ([1, 2, 3, 4, 5].includes(numberValue)) return numberValue as Rating;
  if (sentiment === "positive") return 4;
  if (sentiment === "negative") return 2;
  return 3;
}

function normalizePlan(value: string): Plan {
  const lower = value.toLowerCase();
  if (lower.includes("enterprise")) return "Enterprise";
  if (lower.includes("business")) return "Business";
  if (lower.includes("pro")) return "Pro";
  if (lower.includes("free")) return "Free";
  return "Business";
}
