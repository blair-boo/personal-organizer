import type { CasalMembro, PessoaDocumentos, ResponsavelTipo, TarefaManutencao } from '../types';

/**
 * Responsáveis das tarefas: nenhum (atribuir depois), uma pessoa, ou o casal,
 * que pode ser "qualquer um" dos dois ou "juntos". O casal é um cadastro de
 * Documentos > Pessoais que junta duas pessoas.
 */

type DadosDoResponsavel = Pick<TarefaManutencao, 'responsavel_tipo' | 'responsavel_pessoa_id' | 'responsavel_casal_id'>;

export const SEM_RESPONSAVEL: DadosDoResponsavel = { responsavel_tipo: 'nenhum', responsavel_pessoa_id: null, responsavel_casal_id: null };

export function pessoasIndividuais(pessoas: PessoaDocumentos[]): PessoaDocumentos[] {
  return pessoas.filter((p) => p.tipo === 'pessoa');
}

export function casais(pessoas: PessoaDocumentos[]): PessoaDocumentos[] {
  return pessoas.filter((p) => p.tipo === 'casal');
}

/** casal -> ids das pessoas dele. */
export function membrosPorCasal(membros: CasalMembro[]): Map<string, string[]> {
  const mapa = new Map<string, string[]>();
  for (const m of membros) mapa.set(m.casal_id, [...(mapa.get(m.casal_id) ?? []), m.pessoa_id]);
  return mapa;
}

export interface OpcaoResponsavel extends DadosDoResponsavel {
  /** Valor estável para o campo de escolha. */
  chave: string;
  rotulo: string;
}

/** Escolhas ao atribuir: nenhuma, cada pessoa e, para cada casal, "Qualquer um" e "Juntos". */
export function opcoesDeResponsavel(pessoas: PessoaDocumentos[]): OpcaoResponsavel[] {
  const casaisCadastrados = casais(pessoas);
  const sufixo = (c: PessoaDocumentos) => (casaisCadastrados.length > 1 ? ` (${c.nome})` : '');
  return [
    { chave: 'nenhum', rotulo: 'Nenhuma (atribuir depois)', ...SEM_RESPONSAVEL },
    ...pessoasIndividuais(pessoas).map((p): OpcaoResponsavel => ({ chave: `pessoa:${p.id}`, rotulo: p.nome, responsavel_tipo: 'pessoa', responsavel_pessoa_id: p.id, responsavel_casal_id: null })),
    ...casaisCadastrados.flatMap((c): OpcaoResponsavel[] => [
      { chave: `qualquer:${c.id}`, rotulo: `Qualquer um${sufixo(c)}`, responsavel_tipo: 'qualquer', responsavel_pessoa_id: null, responsavel_casal_id: c.id },
      { chave: `juntos:${c.id}`, rotulo: `Juntos${sufixo(c)}`, responsavel_tipo: 'juntos', responsavel_pessoa_id: null, responsavel_casal_id: c.id },
    ]),
  ];
}

/** A chave da escolha que corresponde ao responsável atual da tarefa. */
export function chaveDoResponsavel(r: DadosDoResponsavel): string {
  if (r.responsavel_tipo === 'pessoa' && r.responsavel_pessoa_id) return `pessoa:${r.responsavel_pessoa_id}`;
  if ((r.responsavel_tipo === 'qualquer' || r.responsavel_tipo === 'juntos') && r.responsavel_casal_id) return `${r.responsavel_tipo}:${r.responsavel_casal_id}`;
  return 'nenhum';
}

/** Pessoas ligadas à tarefa: a própria pessoa, ou os dois do casal. */
export function pessoasDoResponsavel(r: DadosDoResponsavel, membros: Map<string, string[]>): string[] {
  if (r.responsavel_tipo === 'pessoa' && r.responsavel_pessoa_id) return [r.responsavel_pessoa_id];
  if ((r.responsavel_tipo === 'qualquer' || r.responsavel_tipo === 'juntos') && r.responsavel_casal_id) return membros.get(r.responsavel_casal_id) ?? [];
  return [];
}

/** Texto curto do responsável: "Mariana", "Qualquer um (Eduardo ou Mariana)", "Juntos (Eduardo e Mariana)". Vazio se não há. */
export function textoDoResponsavel(r: DadosDoResponsavel, membros: Map<string, string[]>, nomePorId: Map<string, string>): string {
  const nomes = pessoasDoResponsavel(r, membros).map((id) => nomePorId.get(id)).filter((n): n is string => !!n);
  if (r.responsavel_tipo === 'pessoa') return nomes[0] ?? '';
  if (r.responsavel_tipo === 'qualquer' && nomes.length > 0) return `Qualquer um (${nomes.join(' ou ')})`;
  if (r.responsavel_tipo === 'juntos' && nomes.length > 0) return `Juntos (${nomes.join(' e ')})`;
  return '';
}

/**
 * Quem já vem marcado em "Feita hoje". Juntos: os dois. Qualquer um: quem está
 * usando o app, se for do casal, senão os dois. Uma pessoa: ela. Sem responsável:
 * quem está usando o app.
 */
export function pessoasPadraoDaExecucao(r: DadosDoResponsavel, membros: Map<string, string[]>, pessoaLogadaId: string | null): string[] {
  const doResponsavel = pessoasDoResponsavel(r, membros);
  switch (r.responsavel_tipo as ResponsavelTipo) {
    case 'pessoa':
      return doResponsavel;
    case 'juntos':
      return doResponsavel;
    case 'qualquer':
      return pessoaLogadaId && doResponsavel.includes(pessoaLogadaId) ? [pessoaLogadaId] : doResponsavel;
    default:
      return pessoaLogadaId ? [pessoaLogadaId] : [];
  }
}

/** A tarefa é dessa pessoa: atribuída a ela, ou ao casal de que ela faz parte (qualquer um ou juntos). */
export function tarefaDaPessoa(r: DadosDoResponsavel, pessoaId: string, membros: Map<string, string[]>): boolean {
  return pessoasDoResponsavel(r, membros).includes(pessoaId);
}

/** Sem responsável de verdade (inclui o casal que foi excluído). */
export function semResponsavel(r: DadosDoResponsavel, membros: Map<string, string[]>): boolean {
  return pessoasDoResponsavel(r, membros).length === 0;
}

/** Em que coluna do kanban por pessoa a tarefa cai. */
export function colunaDoResponsavel(r: DadosDoResponsavel, membros: Map<string, string[]>): string {
  if (semResponsavel(r, membros)) return 'sem';
  if (r.responsavel_tipo === 'pessoa') return `pessoa:${r.responsavel_pessoa_id}`;
  return r.responsavel_tipo;
}

/** O que gravar na tarefa quando o cartão é solto numa coluna do kanban por pessoa. */
export function responsavelDaColuna(coluna: string, casalId: string | null): DadosDoResponsavel | null {
  if (coluna === 'sem') return SEM_RESPONSAVEL;
  if (coluna.startsWith('pessoa:')) return { responsavel_tipo: 'pessoa', responsavel_pessoa_id: coluna.slice('pessoa:'.length), responsavel_casal_id: null };
  if ((coluna === 'qualquer' || coluna === 'juntos') && casalId) return { responsavel_tipo: coluna, responsavel_pessoa_id: null, responsavel_casal_id: casalId };
  return null;
}
