import { createBrowserClient } from "@supabase/ssr";
import { getSupabaseEnvironment } from "./env";

export function createClient() {
  const { publishableKey, url } = getSupabaseEnvironment();

  return createBrowserClient(url, publishableKey, {
    auth: {
      experimental: { passkey: true },
      flowType: "pkce",
    },
  });
}
