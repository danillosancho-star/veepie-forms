import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { supabase } from './lib/supabase';
import { api } from './lib/api';

interface AuthState {
  loading: boolean;
  authed: boolean;
  me: any;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthCtx = createContext<AuthState>(null as any);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [loading, setLoading] = useState(true);
  const [me, setMe] = useState<any>(null);

  async function loadMe() {
    try {
      const data = await api.me();
      setMe(data);
    } catch {
      setMe(null);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) loadMe();
      else setLoading(false);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session) loadMe();
      else {
        setMe(null);
        setLoading(false);
      }
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw new Error('E-mail ou senha inválidos.');
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setMe(null);
  };

  return (
    <AuthCtx.Provider value={{ loading, authed: !!me, me, signIn, signOut }}>
      {children}
    </AuthCtx.Provider>
  );
}

export const useAuth = () => useContext(AuthCtx);
