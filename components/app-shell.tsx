"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";
import {
  Bot,
  BriefcaseBusiness,
  FileText,
  Inbox,
  LayoutDashboard,
  LogOut,
  Menu,
  Upload,
  Waves
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/components/auth-provider";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger
} from "@/components/ui/dropdown-menu";

const navItems = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/workspaces", label: "Workspaces", icon: BriefcaseBusiness },
  { href: "/import", label: "Import Feedback", icon: Upload },
  { href: "/feedback", label: "Feedback Table", icon: Inbox },
  { href: "/ask-ai", label: "Ask AI", icon: Bot },
  { href: "/reports", label: "Saved Reports", icon: FileText }
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, loading: authLoading, configured, error: authError, signOut } = useAuth();
  const active = navItems.find((item) => pathname.startsWith(item.href));

  useEffect(() => {
    if (!authLoading && configured && !user) {
      router.replace("/auth");
    }
  }, [authLoading, configured, router, user]);

  if (authLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="rounded-lg border bg-card p-6 text-sm text-muted-foreground shadow-sm">Loading workspace...</div>
      </div>
    );
  }

  if (!configured) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-6">
        <div className="max-w-lg rounded-lg border bg-card p-6 shadow-sm">
          <div className="text-lg font-semibold">App is not configured</div>
          <p className="mt-2 text-sm text-muted-foreground">
            The required project settings are missing. Add the deployment environment variables before using the app.
          </p>
          {authError ? <p className="mt-3 text-sm text-destructive">{authError}</p> : null}
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="rounded-lg border bg-card p-6 text-sm text-muted-foreground shadow-sm">Redirecting to login...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 border-r border-slate-200/80 bg-white/90 shadow-sm backdrop-blur lg:block">
        <div className="flex h-full flex-col">
          <div className="flex h-16 items-center gap-3 border-b border-slate-200/80 px-5">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-primary-foreground shadow-sm">
              <Waves className="h-5 w-5" />
            </div>
            <div>
              <div className="text-sm font-semibold">Customer Signal</div>
              <div className="text-xs text-muted-foreground">Feedback intelligence</div>
            </div>
          </div>
          <nav className="flex-1 space-y-1 p-3">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = pathname.startsWith(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-slate-100 hover:text-foreground",
                    isActive && "bg-primary/10 text-primary ring-1 ring-primary/10"
                  )}
                >
                  <Icon className="h-4 w-4" />
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </div>
      </aside>
      <div className="lg:pl-64">
        <header className="sticky top-0 z-20 flex h-16 items-center justify-between border-b border-slate-200/80 bg-white/75 px-4 shadow-sm shadow-slate-200/40 backdrop-blur-xl sm:px-6">
          <div className="flex min-w-0 items-center gap-3">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="icon" className="lg:hidden">
                  <Menu className="h-4 w-4" />
                  <span className="sr-only">Open navigation</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-56">
                {navItems.map((item) => (
                  <DropdownMenuItem key={item.href} asChild>
                    <Link href={item.href}>{item.label}</Link>
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
            <div>
              <h1 className="truncate text-lg font-semibold">{active?.label ?? "Dashboard"}</h1>
              <p className="hidden text-sm text-muted-foreground sm:block">
                Turn customer feedback into product decisions.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => {
                void signOut().then(() => router.replace("/auth"));
              }}
            >
              <LogOut className="h-4 w-4" />
              <span className="sr-only">Log out</span>
            </Button>
          </div>
        </header>
        <main className="mx-auto max-w-[1500px] p-4 sm:p-6">{children}</main>
      </div>
    </div>
  );
}
