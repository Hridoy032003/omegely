import { createClient } from "@supabase/supabase-js";

// Account features are optional. Safe placeholders keep static builds working
// when Supabase is not configured; real browser requests use the public env vars.
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://placeholder.supabase.co";
const supabasePublishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || "public-key-not-configured";

export const supabase = createClient(
  supabaseUrl,
  supabasePublishableKey,
);
