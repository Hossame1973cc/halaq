import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { supabase } from './supabase';

const AuthCtx = createContext(null);

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);
  const [memberships, setMemberships] = useState([]);
  const [profile, setProfile] = useState(null);

  const loadUserData = useCallback(async (s) => {
    if (!s?.user) { setMemberships([]); setProfile(null); return; }
    const [{ data: m }, { data: p }] = await Promise.all([
      supabase.from('shop_members').select('role, shop:shops(id, name, slug, plan, trial_ends_at)').eq('user_id', s.user.id),
      supabase.from('profiles').select('*').eq('id', s.user.id).maybeSingle(),
    ]);
    setMemberships((m || []).filter((x) => x.shop));
    setProfile(p || null);
  }, []);

  useEffect(() => {
    let alive = true;
    supabase.auth.getSession().then(async ({ data }) => {
      if (!alive) return;
      setSession(data.session);
      await loadUserData(data.session);
      setLoading(false);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => {
      setSession(s);
      // defer to avoid calling supabase inside the auth callback
      setTimeout(() => loadUserData(s), 0);
    });
    return () => { alive = false; sub.subscription.unsubscribe(); };
  }, [loadUserData]);

  const value = {
    session,
    user: session?.user || null,
    profile,
    memberships,
    loading,
    refresh: () => loadUserData(session),
    signOut: () => supabase.auth.signOut(),
  };
  return <AuthCtx.Provider value={value}>{children}</AuthCtx.Provider>;
}

export const useAuth = () => useContext(AuthCtx);
