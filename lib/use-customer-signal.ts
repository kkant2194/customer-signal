"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "@/components/auth-provider";
import { fetchCustomerSignalState } from "@/lib/supabase-store";
import type { CustomerSignalState } from "@/lib/types";

const emptyState: CustomerSignalState = {
  workspaces: [],
  feedbackItems: [],
  savedReports: []
};

export function useCustomerSignalState(): CustomerSignalState & {
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
} {
  const { user, configured } = useAuth();
  const [state, setState] = useState<CustomerSignalState>(emptyState);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const refreshingRef = useRef(false);

  const refresh = useCallback(async () => {
    if (!user || !configured) {
      setState(emptyState);
      return;
    }
    if (refreshingRef.current) return;

    refreshingRef.current = true;
    setLoading(true);
    setError(null);
    try {
      setState(await fetchCustomerSignalState());
    } catch (nextError) {
      const message = nextError instanceof Error ? nextError.message : "Unable to load workspace data.";
      setError(message);
    } finally {
      refreshingRef.current = false;
      setLoading(false);
    }
  }, [configured, user]);

  useEffect(() => {
    window.queueMicrotask(() => {
      void refresh();
    });
  }, [refresh]);

  useEffect(() => {
    function refreshVisiblePage() {
      if (document.visibilityState === "visible") {
        void refresh();
      }
    }

    window.addEventListener("focus", refreshVisiblePage);
    document.addEventListener("visibilitychange", refreshVisiblePage);
    const intervalId = window.setInterval(refreshVisiblePage, 30000);

    return () => {
      window.removeEventListener("focus", refreshVisiblePage);
      document.removeEventListener("visibilitychange", refreshVisiblePage);
      window.clearInterval(intervalId);
    };
  }, [refresh]);

  return { ...state, loading, error, refresh };
}

export function useWorkspaceOptions() {
  const state = useCustomerSignalState();
  return useMemo(() => state.workspaces, [state.workspaces]);
}
