"use client";

import { CalendarClock } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { PageHeader } from "@/components/page-header";
import { StatusBadge } from "@/components/status-badge";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger
} from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useCustomerSignalState } from "@/lib/use-customer-signal";

export default function ReportsPage() {
  const { savedReports, loading, error } = useCustomerSignalState();

  return (
    <AppShell>
      <PageHeader
        title="Saved Reports"
        description="Reusable research readouts saved from customer feedback analysis."
      />
      {error ? <div className="mb-4 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div> : null}
      {loading ? <div className="mb-4 rounded-md border bg-muted/30 p-3 text-sm text-muted-foreground">Loading saved reports...</div> : null}
      {savedReports.length ? <ReportsTable reports={savedReports} /> : <EmptyReports label="No saved reports yet." />}
    </AppShell>
  );
}

function ReportsTable({ reports }: { reports: ReturnType<typeof useCustomerSignalState>["savedReports"] }) {
  return (
    <Card>
      <CardContent className="p-4">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Report</TableHead>
              <TableHead>Workspace</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Evidence</TableHead>
              <TableHead>Owner</TableHead>
              <TableHead>Updated</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {reports.map((report) => (
              <TableRow key={report.id}>
                <TableCell>
                  <Dialog>
                    <DialogTrigger className="text-left">
                      <div className="font-medium hover:text-primary">{report.name}</div>
                      <div className="text-xs text-muted-foreground">{report.id}</div>
                    </DialogTrigger>
                    <DialogContent className="max-w-3xl">
                      <DialogHeader>
                        <DialogTitle>{report.name}</DialogTitle>
                        <DialogDescription>{report.workspace} · {report.type} · {report.updated}</DialogDescription>
                      </DialogHeader>
                      {report.answer ? (
                        <div className="space-y-4">
                          <p className="rounded-md border bg-muted/30 p-3 text-sm leading-6">{report.answer}</p>
                          <div>
                            <div className="mb-2 text-sm font-semibold">Themes</div>
                            <div className="flex flex-wrap gap-2">
                              {report.themes?.map((theme) => (
                                <Badge key={theme.name} variant="secondary">{theme.name}: {theme.count}</Badge>
                              ))}
                            </div>
                          </div>
                          <div>
                            <div className="mb-2 text-sm font-semibold">Recommended actions</div>
                            <div className="space-y-2">
                              {report.actions?.map((action) => (
                                <div key={action} className="rounded-md bg-muted/40 p-2 text-sm">{action}</div>
                              ))}
                            </div>
                          </div>
                        </div>
                      ) : (
                        <div className="rounded-md border bg-muted/30 p-4 text-sm text-muted-foreground">
                          This report does not have saved analysis details yet.
                        </div>
                      )}
                    </DialogContent>
                  </Dialog>
                </TableCell>
                <TableCell>{report.workspace}</TableCell>
                <TableCell>{report.type}</TableCell>
                <TableCell><StatusBadge status={report.status} /></TableCell>
                <TableCell>{report.evidenceCount ?? "n/a"}</TableCell>
                <TableCell>{report.owner}</TableCell>
                <TableCell>{report.updated}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

function EmptyReports({ label }: { label: string }) {
  return (
    <Card>
      <CardContent className="flex min-h-60 flex-col items-center justify-center text-center">
        <CalendarClock className="h-8 w-8 text-muted-foreground" />
        <div className="mt-3 font-medium">{label}</div>
        <p className="mt-1 max-w-sm text-sm text-muted-foreground">
          Save an analysis from Ask AI to populate this list.
        </p>
      </CardContent>
    </Card>
  );
}
