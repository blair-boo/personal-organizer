import type { Session } from '@supabase/supabase-js';

/** Chave que o supabase-js usa no localStorage pra guardar a sessão: `sb-<ref do projeto>-auth-token`. */
export function chaveDaSessao(urlSupabase: string): string {
  return `sb-${new URL(urlSupabase).hostname.split('.')[0]}-auth-token`;
}

/**
 * Sessão que o supabase-js deixou guardada no aparelho. Serve pra abrir o app
 * sem internet depois que o token de acesso (dura ~1 h) venceu: sem rede o
 * supabase-js não consegue renová-lo e devolve "sem sessão", o que mostraria a
 * tela de login. Os dados mostrados vêm do cache local; quando a internet
 * volta o token é renovado sozinho. Se a sessão foi invalidada de verdade
 * (logout, refresh token recusado), o supabase-js a apaga do armazenamento, então
 * aqui não sobra nada pra reaproveitar.
 */
export function lerSessaoGuardada(armazenamento: Pick<Storage, 'getItem'>, urlSupabase: string): Session | null {
  try {
    const bruto = armazenamento.getItem(chaveDaSessao(urlSupabase));
    if (!bruto) return null;
    const sessao = JSON.parse(bruto) as Partial<Session> | null;
    if (!sessao || typeof sessao !== 'object' || !sessao.user || !sessao.access_token || !sessao.refresh_token) return null;
    return sessao as Session;
  } catch {
    return null;
  }
}

/**
 * Sessão depois de um evento de login do Supabase. Sem internet, o evento
 * inicial vem com sessão vazia mesmo havendo uma guardada: só o logout de
 * verdade (SIGNED_OUT) pode zerar a sessão que já está na tela.
 */
export function proximaSessao(atual: Session | null, evento: string, nova: Session | null): Session | null {
  if (nova) return nova;
  return evento === 'SIGNED_OUT' ? null : atual;
}
