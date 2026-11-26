import { describe, expect, it } from 'vitest';
import { emailValido, erroDeSenha, nomeDoUsuario, ordenarUsuarios, pessoaDoUsuario, pessoasParaVincular, podeEditarUsuario, podeExcluirUsuario } from './usuarios';
import type { Perfil, PessoaDocumentos } from '../types';

const pessoa = (id: string, nome: string, usuario: string | null, tipo: 'pessoa' | 'casal' = 'pessoa'): PessoaDocumentos => ({ id, nome, tipo, ordem: 0, usuario_id: usuario });
const perfil = (id: string, email: string, confirmado = true): Perfil => ({ usuario_id: id, email, papel: 'membro', confirmado, criado_em: '2026-11-26' });

describe('emailValido', () => {
  it('aceita e rejeita', () => {
    expect(emailValido('a@b.com')).toBe(true);
    expect(emailValido(' a@b.com ')).toBe(true);
    expect(emailValido('a@b')).toBe(false);
    expect(emailValido('a b@c.com')).toBe(false);
    expect(emailValido('')).toBe(false);
  });
});

describe('vínculo entre login e pessoa', () => {
  const pessoas = [pessoa('m', 'Mariana', 'u1'), pessoa('e', 'Eduardo', null), pessoa('c', 'Casal', null, 'casal')];

  it('acha a pessoa do login', () => {
    expect(pessoaDoUsuario(pessoas, 'u1')?.nome).toBe('Mariana');
    expect(pessoaDoUsuario(pessoas, 'u2')).toBeNull();
  });

  it('oferece a pessoa atual e as livres, nunca casal nem pessoa de outro login', () => {
    expect(pessoasParaVincular(pessoas, 'u1').map((p) => p.nome)).toEqual(['Mariana', 'Eduardo']);
    expect(pessoasParaVincular(pessoas, 'u2').map((p) => p.nome)).toEqual(['Eduardo']);
  });

  it('o nome vem da pessoa; sem vínculo, do e-mail', () => {
    expect(nomeDoUsuario({ email: 'x@y.com' }, pessoas[0])).toBe('Mariana');
    expect(nomeDoUsuario({ email: 'x@y.com' }, null)).toBe('x@y.com');
  });
});

describe('permissões', () => {
  it('admin edita todos, cada um edita a si, membro não edita os outros', () => {
    expect(podeEditarUsuario(true, false)).toBe(true);
    expect(podeEditarUsuario(false, true)).toBe(true);
    expect(podeEditarUsuario(false, false)).toBe(false);
  });
  it('só admin exclui, e nunca a si mesmo', () => {
    expect(podeExcluirUsuario(true, false)).toBe(true);
    expect(podeExcluirUsuario(true, true)).toBe(false);
    expect(podeExcluirUsuario(false, false)).toBe(false);
  });
});

describe('ordenarUsuarios', () => {
  it('você primeiro, depois os confirmados, depois os convites pendentes', () => {
    const pessoas = [pessoa('m', 'Mariana', 'u1'), pessoa('b', 'Beto', 'u3')];
    const lista = [perfil('u4', 'pendente@x.com', false), perfil('u3', 'beto@x.com'), perfil('u1', 'mari@x.com')];
    expect(ordenarUsuarios(lista, pessoas, 'u1').map((p) => p.usuario_id)).toEqual(['u1', 'u3', 'u4']);
  });
});

describe('erroDeSenha', () => {
  it('exige tamanho mínimo e confirmação igual', () => {
    expect(erroDeSenha('curta', 'curta')).toMatch(/pelo menos 8/);
    expect(erroDeSenha('senhaboa123', 'outra123456')).toMatch(/não são iguais/);
    expect(erroDeSenha('senhaboa123', 'senhaboa123')).toBeNull();
  });
});
