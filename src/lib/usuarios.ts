import type { PapelUsuario, Perfil, PessoaDocumentos } from '../types';

export const ROTULO_PAPEL: Record<PapelUsuario, string> = { admin: 'Admin', membro: 'Membro' };

export const TAMANHO_MINIMO_SENHA = 8;

export function emailValido(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}

/** A pessoa (individual) ligada a este login, ou null. */
export function pessoaDoUsuario(pessoas: PessoaDocumentos[], usuarioId: string): PessoaDocumentos | null {
  return pessoas.find((p) => p.tipo === 'pessoa' && p.usuario_id === usuarioId) ?? null;
}

/** Pessoas que este login pode ter: a que já tem e as individuais ainda sem login. Uma pessoa só pode ter um login. */
export function pessoasParaVincular(pessoas: PessoaDocumentos[], usuarioId: string): PessoaDocumentos[] {
  return pessoas.filter((p) => p.tipo === 'pessoa' && (p.usuario_id === null || p.usuario_id === usuarioId));
}

/** Nome mostrado na lista: o da pessoa vinculada; sem vínculo, o e-mail. */
export function nomeDoUsuario(perfil: Pick<Perfil, 'email'>, pessoa: Pick<PessoaDocumentos, 'nome'> | null): string {
  return pessoa?.nome ?? perfil.email;
}

/** Admin edita qualquer um; cada um edita o próprio nome, e-mail e ícone. */
export function podeEditarUsuario(souAdmin: boolean, ehVoce: boolean): boolean {
  return souAdmin || ehVoce;
}

/** Só admin exclui, e nunca a si mesmo. */
export function podeExcluirUsuario(souAdmin: boolean, ehVoce: boolean): boolean {
  return souAdmin && !ehVoce;
}

/** Você primeiro, depois quem já aceitou o convite, depois os convites pendentes; dentro de cada grupo, pelo nome. */
export function ordenarUsuarios(perfis: Perfil[], pessoas: PessoaDocumentos[], meuId: string | undefined): Perfil[] {
  const grupo = (p: Perfil) => (p.usuario_id === meuId ? 0 : p.confirmado ? 1 : 2);
  const nome = (p: Perfil) => nomeDoUsuario(p, pessoaDoUsuario(pessoas, p.usuario_id));
  return [...perfis].sort((a, b) => grupo(a) - grupo(b) || nome(a).localeCompare(nome(b), 'pt-BR'));
}

/** Mensagem de erro da nova senha, ou null se está tudo certo. */
export function erroDeSenha(senha: string, confirmacao: string): string | null {
  if (senha.length < TAMANHO_MINIMO_SENHA) return `A senha precisa ter pelo menos ${TAMANHO_MINIMO_SENHA} caracteres.`;
  if (senha !== confirmacao) return 'As duas senhas não são iguais.';
  return null;
}
