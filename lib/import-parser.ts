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

interface PastedSpeakerExtraction {
  customer?: string;
  company?: string;
  role?: string;
  feedback: string;
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
  return splitPastedNotes(text)
    .map((chunk, index) => parsePastedNoteChunk(chunk, index))
    .filter((row): row is ImportPreviewRow => Boolean(row?.feedback));
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

function splitPastedNotes(text: string) {
  const normalized = text.replace(/\r\n/g, "\n").trim();
  if (!normalized) return [];

  const paragraphChunks = normalized
    .split(/\n{2,}/)
    .flatMap((chunk) => splitBulletLines(chunk));

  return paragraphChunks
    .map((chunk) => cleanupPastedChunk(chunk))
    .filter((chunk) => chunk.length >= 8);
}

function splitBulletLines(chunk: string) {
  const lines = chunk.split("\n");
  const contentLines = lines.filter((line) => line.trim());
  const bulletLines = lines.filter((line) => isBulletLine(line));

  if (bulletLines.length >= 2 && bulletLines.length === contentLines.length) {
    return bulletLines;
  }

  if (contentLines.length >= 2 && contentLines.every(looksLikePastedRecord)) {
    return contentLines;
  }

  return [chunk];
}

function parsePastedNoteChunk(chunk: string, index: number): ImportPreviewRow | null {
  const sourceMatch = chunk.match(/^#([\w-]+)\s*\/\s*/);
  const source = sourceMatch ? titleCase(sourceMatch[1].replace(/-/g, " ")) : "Pasted notes";
  const withoutSource = sourceMatch ? chunk.slice(sourceMatch[0].length).trim() : chunk;
  const extracted = extractPastedSpeaker(withoutSource);
  const feedback = cleanupPastedChunk(extracted.feedback);

  if (!feedback) return null;

  const customer = extracted.customer || "Unknown customer";
  const metadata = {
    paste_row: index + 1,
    ...(extracted.company ? { company: extracted.company } : {}),
    ...(extracted.role ? { role: extracted.role } : {}),
    ...(sourceMatch ? { channel: sourceMatch[1] } : {})
  };

  return normalizeImportRow(
    {
      source,
      customer,
      title: buildPastedTitle(customer, feedback),
      feedback,
      ...extractInlineMetadata(withoutSource),
      ...metadata
    },
    {
      feedback: "feedback",
      customer: "customer",
      source: "source",
      title: "title",
      rating: "rating",
      sentiment: "sentiment",
      plan: "plan"
    }
  );
}

function extractPastedSpeaker(text: string): PastedSpeakerExtraction {
  const colonIndex = text.indexOf(":");
  if (colonIndex === -1 || colonIndex > 120) {
    return { feedback: text };
  }

  const prefix = cleanupPastedChunk(text.slice(0, colonIndex));
  const feedback = text.slice(colonIndex + 1).trim();
  if (!prefix || !feedback || looksLikeSentence(prefix)) {
    return { feedback: text };
  }

  const fromMatch = prefix.match(/^(.+?)\s+from\s+(.+)$/i);
  if (fromMatch) {
    return {
      customer: fromMatch[1].trim(),
      company: fromMatch[2].trim(),
      feedback
    };
  }

  const roleMatch = prefix.match(/^(.+?)\s+\((.+?)\)$/);
  if (roleMatch) {
    return {
      customer: roleMatch[1].trim(),
      role: roleMatch[2].trim(),
      feedback
    };
  }

  return {
    customer: prefix,
    feedback
  };
}

function extractInlineMetadata(text: string): RawImportRow {
  const metadata: RawImportRow = {};
  const ratingMatch = text.match(/\b(?:rating|stars|score)\s*[:=]\s*([1-5])\b/i);
  const sentimentMatch = text.match(/\b(?:sentiment|tone)\s*[:=]\s*(positive|negative|neutral|mixed)\b/i);
  const planMatch = text.match(/\b(?:plan|tier)\s*[:=]\s*(enterprise|business|pro|free)\b/i);

  if (ratingMatch) metadata.rating = Number(ratingMatch[1]);
  if (sentimentMatch) metadata.sentiment = sentimentMatch[1];
  if (planMatch) metadata.plan = planMatch[1];

  return metadata;
}

function cleanupPastedChunk(chunk: string) {
  return chunk
    .trim()
    .replace(/^[-*•]\s+/, "")
    .replace(/^\d+[.)]\s+/, "")
    .replace(/^["']|["']$/g, "")
    .trim();
}

function isBulletLine(line: string) {
  return /^\s*(?:[-*•]|\d+[.)])\s+\S/.test(line);
}

function looksLikePastedRecord(line: string) {
  const trimmed = cleanupPastedChunk(line);
  const colonIndex = trimmed.indexOf(":");
  return colonIndex > 0 && colonIndex <= 120 && trimmed.length - colonIndex > 12;
}

function looksLikeSentence(text: string) {
  return /\s/.test(text) && text.length > 48;
}

function buildPastedTitle(customer: string, feedback: string) {
  const firstSentence = feedback.split(/[.!?]\s/)[0]?.trim();
  const summary = firstSentence && firstSentence.length >= 12 ? firstSentence : feedback;
  return `${customer}: ${summary}`.slice(0, 84);
}

function titleCase(value: string) {
  return value.replace(/\b\w/g, (letter) => letter.toUpperCase());
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
