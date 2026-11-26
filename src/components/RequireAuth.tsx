import type { ReactNode } from 'react';
import { useAuth } from '../auth/AuthContext';
import { DefinirSenhaPage } from '../pages/DefinirSenhaPage';
import { LoginPage } from '../pages/LoginPage';

export function RequireAuth({ children }: { children: ReactNode }) {
  const { session, loading, precisaDefinirSenha } = useAuth();

  if (loading) return <div className="loading-screen">Carregando…</div>;
  if (!session) return <LoginPage />;
  if (precisaDefinirSenha) return <DefinirSenhaPage />;
  return <>{children}</>;
}
