import { createClient, type SupabaseClient } from "@supabase/supabase-js";

export function createAuthenticatedSupabase(authorization: string) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error("App configuration is incomplete.");
  }

  return createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: authorization } },
    auth: { persistSession: false, autoRefreshToken: false }
  });
}

export async function getAuthenticatedUser(supabase: SupabaseClient) {
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) {
    throw new Error("Not authenticated.");
  }
  return data.user;
}

export async function trackUsage(
  supabase: SupabaseClient,
  userId: string,
  eventName: string,
  metadata: Record<string, unknown>
) {
  await supabase.from("usage_events").insert({
    user_id: userId,
    event_name: eventName,
    metadata
  });
}

export function requireBearerToken(authorization: string | null) {
  if (!authorization?.startsWith("Bearer ")) {
    throw new Error("Missing access token.");
  }
  return authorization;
}
