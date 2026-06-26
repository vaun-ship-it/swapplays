import { createClient } from "@supabase/supabase-js";

export const supabaseUrl = "https://xzxktizlgsmhsoadpkab.supabase.co";
export const supabasePublishableKey = "sb_publishable_5C5vtDTzyn-wlOPy9eX11w_gTOaVxP5";

export const supabase = createClient(supabaseUrl, supabasePublishableKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true
  }
});

export const storageBuckets = {
  mediaUploads: "media-uploads"
} as const;

export const tables = {
  profiles: "profiles",
  campaigns: "campaigns",
  passCodes: "pass_codes",
  playHistory: "play_history"
} as const;
