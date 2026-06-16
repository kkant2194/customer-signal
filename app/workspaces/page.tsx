"use client";

import { MoreHorizontal, Plus, Trash2, Users } from "lucide-react";
import { useState } from "react";
import { useToast } from "@/components/toast-provider";
import { AppShell } from "@/components/app-shell";
import { PageHeader } from "@/components/page-header";
import { StatusBadge } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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
  DropdownMenuTrigger
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  createWorkspace,
  deleteWorkspace,
  renameWorkspace
} from "@/lib/supabase-store";
import { useCustomerSignalState } from "@/lib/use-customer-signal";
import type { Workspace } from "@/lib/types";

export default function WorkspacesPage() {
  const { toast } = useToast();
  const { workspaces, loading, error, refresh } = useCustomerSignalState();
  const [createOpen, setCreateOpen] = useState(false);
  const [editing, setEditing] = useState<Workspace | null>(null);
  const [name, setName] = useState("");
  const [product, setProduct] = useState("");
  const [owner, setOwner] = useState("");
  const [saving, setSaving] = useState(false);

  async function handleCreate() {
    if (!name.trim()) return;
    setSaving(true);
    try {
      await createWorkspace({ name, product, owner });
      await refresh();
      setName("");
      setProduct("");
      setOwner("");
      setCreateOpen(false);
      toast({ title: "Workspace created", description: `${name} is ready for feedback.`, variant: "success" });
    } catch (nextError) {
      toast({
        title: "Could not create workspace",
        description: nextError instanceof Error ? nextError.message : "Try again.",
        variant: "error"
      });
    } finally {
      setSaving(false);
    }
  }

  async function handleRename() {
    if (!editing) return;
    setSaving(true);
    try {
      await renameWorkspace(editing.id, name);
      await refresh();
      setEditing(null);
      setName("");
      toast({ title: "Workspace renamed", description: "The workspace name is up to date.", variant: "success" });
    } catch (nextError) {
      toast({
        title: "Could not rename workspace",
        description: nextError instanceof Error ? nextError.message : "Try again.",
        variant: "error"
      });
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(workspace: Workspace) {
    setSaving(true);
    try {
      await deleteWorkspace(workspace.id);
      await refresh();
      toast({ title: "Workspace deleted", description: `${workspace.name} was removed.`, variant: "success" });
    } catch (nextError) {
      toast({
        title: "Could not delete workspace",
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
        title="Workspaces"
        description="Separate feedback streams by product area, roadmap team, or research program."
        actions={
          <Dialog open={createOpen} onOpenChange={setCreateOpen}>
            <DialogTrigger asChild>
              <Button size="sm"><Plus className="h-4 w-4" /> Workspace</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Create workspace</DialogTitle>
                <DialogDescription>Create a dedicated area for a product, team, or research program.</DialogDescription>
              </DialogHeader>
              <div className="space-y-3">
                <Label htmlFor="workspace-name">Workspace name</Label>
                <Input id="workspace-name" value={name} onChange={(event) => setName(event.target.value)} placeholder="Expansion research" />
                <Label htmlFor="product-area">Product area</Label>
                <Input id="product-area" value={product} onChange={(event) => setProduct(event.target.value)} placeholder="Billing, mobile, admin..." />
                <Label htmlFor="owner">Owner</Label>
                <Input id="owner" value={owner} onChange={(event) => setOwner(event.target.value)} placeholder="Product manager" />
                <Button className="w-full" disabled={saving} onClick={() => void handleCreate()}>
                  {saving ? "Creating..." : "Create workspace"}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        }
      />

      <Dialog open={Boolean(editing)} onOpenChange={(open) => !open && setEditing(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Rename workspace</DialogTitle>
            <DialogDescription>Feedback and reports linked to this workspace will keep the new name.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <Label htmlFor="rename-workspace">Workspace name</Label>
            <Input id="rename-workspace" value={name} onChange={(event) => setName(event.target.value)} />
            <Button className="w-full" disabled={saving} onClick={() => void handleRename()}>
              {saving ? "Saving..." : "Save name"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {error ? <div className="mb-4 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div> : null}

      {loading ? (
        <div className="rounded-lg border bg-card p-6 text-sm text-muted-foreground">Loading workspaces...</div>
      ) : workspaces.length === 0 ? (
        <div className="rounded-lg border bg-card p-8 text-center">
          <div className="font-semibold">No workspaces yet</div>
          <p className="mt-2 text-sm text-muted-foreground">Create your first workspace to start importing customer feedback.</p>
        </div>
      ) : (
      <div className="grid gap-4 lg:grid-cols-3">
        {workspaces.map((workspace) => (
          <Card key={workspace.id}>
            <CardHeader>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <CardTitle>{workspace.name}</CardTitle>
                  <CardDescription>{workspace.product}</CardDescription>
                </div>
                <div className="flex items-center gap-2">
                  <StatusBadge status={workspace.health} />
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon"><MoreHorizontal className="h-4 w-4" /></Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem
                        onClick={() => {
                          setEditing(workspace);
                          setName(workspace.name);
                        }}
                      >
                        Rename
                      </DropdownMenuItem>
                      <DropdownMenuItem className="text-destructive" onClick={() => void handleDelete(workspace)}>
                        <Trash2 className="mr-2 h-4 w-4" /> Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-3 gap-3 text-sm">
                <div><div className="font-semibold">{workspace.sources}</div><div className="text-muted-foreground">Sources</div></div>
                <div><div className="font-semibold">{workspace.feedbackCount.toLocaleString()}</div><div className="text-muted-foreground">Feedback</div></div>
                <div><div className="font-semibold">{workspace.activeMembers}</div><div className="text-muted-foreground">Members</div></div>
              </div>
              <div className="flex items-center justify-between rounded-md bg-muted/60 p-3 text-sm">
                <span className="flex items-center gap-2"><Users className="h-4 w-4" /> Owner</span>
                <span className="font-medium">{workspace.owner}</span>
              </div>
              <div className="text-xs text-muted-foreground">Last sync {workspace.lastSync}</div>
            </CardContent>
          </Card>
        ))}
      </div>
      )}
    </AppShell>
  );
}
