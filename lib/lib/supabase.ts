import { createClient } from "@supabase/supabase-js";

export const supabaseUrl = "https://xzxktizlgsmhsoadpkab.supabase.co";
export const supabasePublishableKey = "sb_publishable_5C5vtDTzyn-wlOPy9eX11w_gTOaVxP5";

const maxAuthCookieChunks = 20;
const authCookieChunkSize = 3000;

function authCookieName(key: string) {
  return `swapplays_${key.replace(/[^a-z0-9_-]/gi, "_")}`;
}

function readCookie(name: string) {
  if (typeof document === "undefined") return null;
  const prefix = `${name}=`;
  const cookie = document.cookie.split("; ").find((item) => item.startsWith(prefix));
  return cookie ? cookie.slice(prefix.length) : null;
}

function writeCookie(name: string, value: string, maxAge: number) {
  if (typeof window === "undefined" || typeof document === "undefined") return;
  const domain = window.location.hostname === "swapplays.com" || window.location.hostname.endsWith(".swapplays.com")
    ? "; Domain=.swapplays.com"
    : "";
  const secure = window.location.protocol === "https:" ? "; Secure" : "";
  document.cookie = `${name}=${value}; Path=/; Max-Age=${maxAge}; SameSite=Lax${secure}${domain}`;
}

const durableBrowserStorage = typeof window === "undefined" ? undefined : {
  getItem(key: string) {
    try {
      const stored = window.localStorage.getItem(key);
      if (stored) return stored;
    } catch {
      // Safari can make localStorage unavailable in some privacy modes.
    }

    const cookieName = authCookieName(key);
    const chunkCount = Number(readCookie(`${cookieName}_count`) || 0);
    if (!Number.isInteger(chunkCount) || chunkCount < 1 || chunkCount > maxAuthCookieChunks) return null;

    let encoded = "";
    for (let index = 0; index < chunkCount; index += 1) {
      const chunk = readCookie(`${cookieName}_${index}`);
      if (chunk === null) return null;
      encoded += chunk;
    }

    try {
      return decodeURIComponent(encoded);
    } catch {
      return null;
    }
  },
  setItem(key: string, value: string) {
    try {
      window.localStorage.setItem(key, value);
    } catch {
      // The cookie copy below remains available across tabs.
    }

    const cookieName = authCookieName(key);
    const encoded = encodeURIComponent(value);
    const chunks = Math.ceil(encoded.length / authCookieChunkSize);
    if (chunks > maxAuthCookieChunks) return;

    for (let index = 0; index < maxAuthCookieChunks; index += 1) {
      const chunk = index < chunks ? encoded.slice(index * authCookieChunkSize, (index + 1) * authCookieChunkSize) : "";
      writeCookie(`${cookieName}_${index}`, chunk, index < chunks ? 31536000 : 0);
    }
    writeCookie(`${cookieName}_count`, String(chunks), 31536000);
  },
  removeItem(key: string) {
    try {
      window.localStorage.removeItem(key);
    } catch {
      // Continue clearing the cookie fallback.
    }

    const cookieName = authCookieName(key);
    writeCookie(`${cookieName}_count`, "", 0);
    for (let index = 0; index < maxAuthCookieChunks; index += 1) {
      writeCookie(`${cookieName}_${index}`, "", 0);
    }
  }
};

export const supabase = createClient(supabaseUrl, supabasePublishableKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true,
    storage: durableBrowserStorage
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
