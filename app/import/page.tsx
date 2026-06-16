"use client";

import { AlertCircle, FileSpreadsheet, UploadCloud } from "lucide-react";
import { useMemo, useRef, useState } from "react";
import { AppShell } from "@/components/app-shell";
import { PageHeader } from "@/components/page-header";
import { SentimentBadge } from "@/components/status-badge";
import { useToast } from "@/components/toast-provider";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { normalizeRows, parseCsvFile, parsePastedFeedback, type ColumnMapping, type ParsedCsvImport } from "@/lib/import-parser";
import { getSupabaseClient } from "@/lib/supabase/client";
import type { ImportPreviewRow } from "@/lib/types";
import { useCustomerSignalState } from "@/lib/use-customer-signal";

const defaultPaste =
  "";

export default function ImportPage() {
  const { toast } = useToast();
  const { workspaces, loading, error, refresh } = useCustomerSignalState();
  const fileRef = useRef<HTMLInputElement>(null);
  const [workspaceId, setWorkspaceId] = useState("");
  const [pasteText, setPasteText] = useState(defaultPaste);
  const [previewRows, setPreviewRows] = useState<ImportPreviewRow[]>([]);
  const [csvImport, setCsvImport] = useState<ParsedCsvImport | null>(null);
  const [columnMapping, setColumnMapping] = useState<ColumnMapping>({});
  const [message, setMessage] = useState("Preview rows before importing them.");
  const [saving, setSaving] = useState(false);
  const activeWorkspace = useMemo(
    () => workspaces.find((workspace) => workspace.id === workspaceId) ?? workspaces[0],
    [workspaceId, workspaces]
  );

  function previewPaste() {
    const rows = parsePastedFeedback(pasteText);
    setCsvImport(null);
    setColumnMapping({});
    setPreviewRows(rows);
    setMessage(`${rows.length} pasted rows ready to import.`);
  }

  async function handleCsv(file: File | undefined) {
    if (!file) return;
    try {
      const result = await parseCsvFile(file);
      setCsvImport(result);
      setColumnMapping(result.suggestedMapping);
      setPreviewRows(result.previewRows);
      setMessage(`${result.previewRows.length} rows parsed. ${result.kind === "unknown_csv" ? "Review column mapping before import." : "Column mapping was detected automatically."}`);
      toast({
        title: result.kind === "unknown_csv" ? "CSV needs mapping" : "CSV parsed",
        description: `${result.previewRows.length} rows are ready to preview.`,
        variant: result.kind === "unknown_csv" ? "info" : "success"
      });
    } catch (nextError) {
      toast({
        title: "CSV parsing failed",
        description: nextError instanceof Error ? nextError.message : "Check the file and try again.",
        variant: "error"
      });
    }
  }

  function updateMapping(field: keyof ColumnMapping, column: string) {
    if (!csvImport) return;
    const nextMapping = {
      ...columnMapping,
      [field]: column === "__none" ? undefined : column
    };
    setColumnMapping(nextMapping);
    const rows = normalizeRows(csvImport.rows, nextMapping);
    setPreviewRows(rows);
    setMessage(`${rows.length} rows staged with your column mapping.`);
  }

  async function handleSaveImport() {
    if (!activeWorkspace || previewRows.length === 0) return;
    setSaving(true);
    try {
      await importRows(activeWorkspace.id, previewRows);
      await refresh();
      setMessage(`${previewRows.length} rows saved to ${activeWorkspace.name}.`);
      setPreviewRows([]);
      toast({ title: "Feedback imported", description: `${previewRows.length} rows saved to ${activeWorkspace.name}.`, variant: "success" });
    } catch (nextError) {
      toast({
        title: "Import failed",
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
        title="Import Feedback"
        description="Paste raw notes or upload CSV files, review the preview, then save them to a workspace."
      />
      {error ? <div className="mb-4 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div> : null}
      <div className="grid gap-5 xl:grid-cols-[0.9fr_1.1fr]">
        <Card>
          <CardHeader>
            <CardTitle>Add feedback</CardTitle>
            <CardDescription>Choose a target workspace before staging rows.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {workspaces.length ? (
              <Select value={activeWorkspace.id} onValueChange={setWorkspaceId} disabled={loading}>
                <SelectTrigger><SelectValue placeholder="Select workspace" /></SelectTrigger>
                <SelectContent>
                  {workspaces.map((workspace) => (
                    <SelectItem key={workspace.id} value={workspace.id}>{workspace.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              <div className="rounded-md border bg-muted/30 p-3 text-sm text-muted-foreground">
                Create a workspace before importing feedback.
              </div>
            )}
            <Tabs defaultValue="paste">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="paste">Paste text</TabsTrigger>
                <TabsTrigger value="csv">Upload CSV</TabsTrigger>
              </TabsList>
              <TabsContent value="paste" className="space-y-3">
                <Textarea
                  className="min-h-56"
                  value={pasteText}
                  onChange={(event) => setPasteText(event.target.value)}
                  placeholder="Paste support tickets, interview notes, call summaries, app reviews, or NPS comments..."
                />
                <div className="flex justify-end gap-2">
                  <Button variant="outline" onClick={() => setPasteText("")}>Clear</Button>
                  <Button onClick={previewPaste}>Preview import</Button>
                </div>
              </TabsContent>
              <TabsContent value="csv">
                <input
                  ref={fileRef}
                  type="file"
                  accept=".csv,text/csv"
                  className="hidden"
                  onChange={(event) => void handleCsv(event.target.files?.[0])}
                />
                <div className="flex min-h-56 flex-col items-center justify-center rounded-lg border border-dashed bg-muted/30 p-6 text-center">
                  <UploadCloud className="h-8 w-8 text-muted-foreground" />
                  <div className="mt-3 text-sm font-medium">Drop or choose a CSV file</div>
                  <p className="mt-1 max-w-sm text-sm text-muted-foreground">
                    Known columns are mapped automatically. Unknown CSVs can be mapped before import.
                  </p>
                  <Button variant="outline" className="mt-4" onClick={() => fileRef.current?.click()}>
                    <FileSpreadsheet className="h-4 w-4" /> Choose file
                  </Button>
                </div>
              </TabsContent>
            </Tabs>
            {csvImport ? (
              <div className="rounded-lg border bg-muted/20 p-3">
                <div className="mb-3 flex items-start gap-2 text-sm">
                  <AlertCircle className="mt-0.5 h-4 w-4 text-muted-foreground" />
                  <div>
                    <div className="font-medium">Column mapping</div>
                    <p className="text-muted-foreground">
                      Pick the columns that describe each feedback record. Unmapped columns are saved as metadata.
                    </p>
                  </div>
                </div>
                <div className="grid grid-cols-[repeat(auto-fit,minmax(180px,1fr))] gap-3">
                  <MappingSelect label="Feedback text" field="feedback" required columns={csvImport.columns} mapping={columnMapping} onChange={updateMapping} />
                  <MappingSelect label="Title" field="title" columns={csvImport.columns} mapping={columnMapping} onChange={updateMapping} />
                  <MappingSelect label="Customer" field="customer" columns={csvImport.columns} mapping={columnMapping} onChange={updateMapping} />
                  <MappingSelect label="Source" field="source" columns={csvImport.columns} mapping={columnMapping} onChange={updateMapping} />
                  <MappingSelect label="Rating" field="rating" columns={csvImport.columns} mapping={columnMapping} onChange={updateMapping} />
                  <MappingSelect label="Sentiment" field="sentiment" columns={csvImport.columns} mapping={columnMapping} onChange={updateMapping} />
                  <MappingSelect label="Plan" field="plan" columns={csvImport.columns} mapping={columnMapping} onChange={updateMapping} />
                </div>
              </div>
            ) : null}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-start justify-between gap-3">
              <div>
                <CardTitle>Preview</CardTitle>
                <CardDescription>{message}</CardDescription>
              </div>
              <Button size="sm" disabled={!previewRows.length || !activeWorkspace || saving} onClick={() => void handleSaveImport()}>
                {saving ? "Saving..." : `Save ${previewRows.length || ""} rows`}
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {previewRows.length ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Source</TableHead>
                    <TableHead>Customer</TableHead>
                    <TableHead>Feedback</TableHead>
                    <TableHead>Rating</TableHead>
                    <TableHead>Plan</TableHead>
                    <TableHead>Sentiment</TableHead>
                    <TableHead>Metadata</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {previewRows.map((row, index) => (
                    <TableRow key={`${row.customer}-${index}`}>
                      <TableCell>{row.source}</TableCell>
                      <TableCell className="font-medium">{row.customer}</TableCell>
                      <TableCell className="min-w-72">{row.feedback}</TableCell>
                      <TableCell>{row.rating}</TableCell>
                      <TableCell>{row.plan}</TableCell>
                      <TableCell><SentimentBadge sentiment={row.sentiment} /></TableCell>
                      <TableCell className="text-xs text-muted-foreground">{Object.keys(row.metadata ?? {}).length} fields</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <div className="flex min-h-72 flex-col items-center justify-center rounded-md border bg-muted/30 p-6 text-center">
                <FileSpreadsheet className="h-8 w-8 text-muted-foreground" />
                <div className="mt-3 font-medium">{workspaces.length ? "No rows staged" : "Create a workspace first"}</div>
                <p className="mt-1 max-w-sm text-sm text-muted-foreground">
                  Paste notes or upload one of the CSV files from `sample_datasets/` to preview rows before import.
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}

function MappingSelect({
  label,
  field,
  columns,
  mapping,
  required,
  onChange
}: {
  label: string;
  field: keyof ColumnMapping;
  columns: string[];
  mapping: ColumnMapping;
  required?: boolean;
  onChange: (field: keyof ColumnMapping, column: string) => void;
}) {
  return (
    <div className="min-w-0 space-y-1">
      <div className="truncate text-xs font-medium text-muted-foreground">{label}{required ? " *" : ""}</div>
      <Select value={mapping[field] ?? "__none"} onValueChange={(value) => onChange(field, value)}>
        <SelectTrigger className="min-w-0 overflow-hidden">
          <SelectValue />
        </SelectTrigger>
        <SelectContent className="max-w-72">
          <SelectItem value="__none">Not mapped</SelectItem>
          {columns.map((column) => (
            <SelectItem key={column} value={column}>{column}</SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

async function importRows(workspaceId: string, rows: ImportPreviewRow[]) {
  const supabase = getSupabaseClient();
  const { data } = supabase ? await supabase.auth.getSession() : { data: { session: null } };
  const accessToken = data.session?.access_token;
  if (!accessToken) {
    throw new Error("You must be logged in before importing feedback.");
  }

  const response = await fetch("/api/import-feedback", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`
    },
    body: JSON.stringify({
      workspace_id: workspaceId,
      rows
    })
  });
  const payload = await response.json();
  if (!response.ok) {
    throw new Error(payload.error ?? "Feedback import failed.");
  }
}
