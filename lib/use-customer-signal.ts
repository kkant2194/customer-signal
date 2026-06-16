"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
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

  const refresh = useCallback(async () => {
    if (!user || !configured) {
      setState(emptyState);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      setState(await fetchCustomerSignalState());
    } catch (nextError) {
      const message = nextError instanceof Error ? nextError.message : "Unable to load workspace data.";
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [configured, user]);

  useEffect(() => {
    window.queueMicrotask(() => {
      void refresh();
    });
  }, [refresh]);

  return { ...state, loading, error, refresh };
}

export function useWorkspaceOptions() {
  const state = useCustomerSignalState();
  return useMemo(() => state.workspaces, [state.workspaces]);
}
