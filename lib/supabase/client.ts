import { createClient } from "@supabase/supabase-js";
import { assertVisibleAsciiHeaderValue, normalizeHeaderToken } from "@/lib/http/safeHeaders";

function getSupabaseUrl() {
  return process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/rest\/v1\/?$/, "").replace(/\/$/, "");
}

function getSupabaseAnonKey() {
  return normalizeHeaderToken(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
}

export function isSupabaseConfigured() {
  return Boolean(
    getSupabaseUrl() &&
      getSupabaseAnonKey()
  );
}

export function createBrowserSupabaseClient() {
  const supabaseUrl = getSupabaseUrl();
  const supabaseAnonKey = getSupabaseAnonKey();

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY");
  }

  assertVisibleAsciiHeaderValue("NEXT_PUBLIC_SUPABASE_ANON_KEY", supabaseAnonKey);

  return createClient(supabaseUrl, supabaseAnonKey);
}
