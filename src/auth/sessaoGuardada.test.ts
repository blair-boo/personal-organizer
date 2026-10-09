import { describe, expect, it } from 'vitest';
import type { Session } from '@supabase/supabase-js';
import { chaveDaSessao, lerSessaoGuardada, proximaSessao } from './sessaoGuardada';

const URL_PROJETO = 'https://sjhvnhfwajacpqpwogks.supabase.co';
const sessaoValida = { access_token: 'a', refresh_token: 'r', expires_at: 1, user: { id: 'u1', email: 'x@y.z' } };

function armazenamento(conteudo: Record<string, string>) {
  return { getItem: (chave: string) => conteudo[chave] ?? null };
}

describe('chaveDaSessao', () => {
  it('usa o ref do projeto, como o supabase-js', () => {
    expect(chaveDaSessao(URL_PROJETO)).toBe('sb-sjhvnhfwajacpqpwogks-auth-token');
  });
});

describe('lerSessaoGuardada', () => {
  it('devolve a sessão guardada', () => {
    const lida = lerSessaoGuardada(armazenamento({ [chaveDaSessao(URL_PROJETO)]: JSON.stringify(sessaoValida) }), URL_PROJETO);
    expect(lida?.user.id).toBe('u1');
  });

  it('sem nada guardado, devolve null', () => {
    expect(lerSessaoGuardada(armazenamento({}), URL_PROJETO)).toBeNull();
  });

  it('ignora conteúdo quebrado ou incompleto', () => {
    const chave = chaveDaSessao(URL_PROJETO);
    expect(lerSessaoGuardada(armazenamento({ [chave]: 'não é json' }), URL_PROJETO)).toBeNull();
    expect(lerSessaoGuardada(armazenamento({ [chave]: JSON.stringify({ access_token: 'a' }) }), URL_PROJETO)).toBeNull();
    expect(lerSessaoGuardada(armazenamento({ [chave]: 'null' }), URL_PROJETO)).toBeNull();
  });

  it('se o armazenamento lançar erro, devolve null', () => {
    const quebrado = { getItem: () => { throw new Error('bloqueado'); } };
    expect(lerSessaoGuardada(quebrado, URL_PROJETO)).toBeNull();
  });
});

describe('proximaSessao', () => {
  const atual = sessaoValida as unknown as Session;
  const nova = { ...sessaoValida, access_token: 'b' } as unknown as Session;

  it('uma sessão nova substitui a atual', () => {
    expect(proximaSessao(atual, 'TOKEN_REFRESHED', nova)).toBe(nova);
  });

  it('só o logout de verdade zera a sessão', () => {
    expect(proximaSessao(atual, 'SIGNED_OUT', null)).toBeNull();
  });

  it('evento inicial vazio (sem internet) não derruba a sessão guardada', () => {
    expect(proximaSessao(atual, 'INITIAL_SESSION', null)).toBe(atual);
  });
});
