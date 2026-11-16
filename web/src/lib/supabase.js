import { createClient } from '@supabase/supabase-js';
import { mockSupabase } from './mockSupabase';

const url = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

// Demo build (npm run build:demo): runs fully in the browser with sample data, no server needed.
export const IS_DEMO = import.meta.env.VITE_DEMO === '1';
// Hash URLs (/#/s/shop) for static hosts without SPA rewrites, e.g. GitHub Pages
export const HASH_ROUTER = IS_DEMO || import.meta.env.VITE_HASH_ROUTER === '1';

export const isConfigured = IS_DEMO || Boolean(url && anonKey && !url.includes('YOUR-PROJECT'));

export const supabase = IS_DEMO
  ? mockSupabase
  : isConfigured
    ? createClient(url, anonKey, { auth: { persistSession: true, autoRefreshToken: true, flowType: 'pkce' } })
    : null;

const BASE_URL = IS_DEMO
  ? window.location.href.split('#')[0]
  : (import.meta.env.VITE_SITE_URL || window.location.origin).replace(/\/$/, '');

/** Prefix for in-app links shared outside the app (QR, WhatsApp): append '/s/slug' etc. */
export const SITE_URL = IS_DEMO ? `${BASE_URL}#` : HASH_ROUTER ? `${BASE_URL.replace(/\/$/, '')}/#` : BASE_URL;

/** URL for Supabase email links (verification / password reset) that lands on an app route */
export function authRedirect(route) {
  return HASH_ROUTER ? `${BASE_URL.replace(/\/$/, '')}/?go=${encodeURIComponent(route)}` : `${BASE_URL}${route}`;
}

/** Public URL of a file in the shop-media bucket */
export function mediaUrl(path) {
  if (!path) return null;
  if (/^(https?:|data:|\/)/.test(path)) return path;
  return supabase.storage.from('shop-media').getPublicUrl(path).data.publicUrl;
}
