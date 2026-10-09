import type { Session } from '@supabase/supabase-js';
import { useQueryClient } from '@tanstack/react-query';
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { limparTudoAoSair } from '../lib/offline/limpar';
import { supabase } from '../lib/supabaseClient';
import { lerSessaoGuardada, proximaSessao } from './sessaoGuardada';

interface AuthState {
  session: Session | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const queryClient = useQueryClient();

  useEffect(() => {
    // Sem internet o supabase-js tenta renovar o token vencido por até ~30 s antes de desistir, e o app
    // ficaria em "Carregando…" esse tempo todo. Com uma sessão guardada, abre na hora com ela (os dados
    // vêm do aparelho) e deixa o supabase-js terminar a verificação por baixo.
    const guardada = lerSessaoGuardada(localStorage, import.meta.env.VITE_SUPABASE_URL);
    if (guardada && !navigator.onLine) {
      setSession(guardada);
      setLoading(false);
    }
    supabase.auth.getSession().then(({ data }) => {
      // O token vencido não renova sem internet e o supabase-js devolve "sem sessão": mantém a guardada.
      setSession((atual) => data.session ?? atual ?? guardada);
      setLoading(false);
    });
    const { data: listener } = supabase.auth.onAuthStateChange((event, newSession) => {
      setSession((atual) => proximaSessao(atual, event, newSession));
    });
    return () => listener.subscription.unsubscribe();
  }, []);

  async function signIn(email: string, password: string) {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return { error: error?.message ?? null };
  }

  async function signOut() {
    await supabase.auth.signOut();
    await limparTudoAoSair(queryClient);
  }

  return <AuthContext.Provider value={{ session, loading, signIn, signOut }}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth precisa estar dentro de <AuthProvider>');
  return ctx;
}
