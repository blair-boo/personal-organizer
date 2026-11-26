import { createClient } from '@supabase/supabase-js';
import { criarFetchComLimite } from './fetchComLimite';

const url = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!url || !anonKey) {
  throw new Error(
    'VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY não configuradas. Copie .env.example para .env e preencha.'
  );
}

/**
 * Tipo do link que abriu o app (convite ou recuperação de senha), lido ANTES de criar o cliente:
 * o supabase-js troca o #access_token por uma sessão e limpa o endereço. Quem chega por convite
 * entra sem senha, então o app precisa pedir uma.
 */
function lerTipoDoLink(): 'invite' | 'recovery' | null {
  if (typeof window === 'undefined') return null;
  const tipo = new URLSearchParams(window.location.hash.replace(/^#/, '')).get('type');
  return tipo === 'invite' || tipo === 'recovery' ? tipo : null;
}

export const TIPO_DO_LINK_DE_ACESSO = lerTipoDoLink();

export const supabase = createClient(url, anonKey, { global: { fetch: criarFetchComLimite() } });
