import { tarefaAtrasada } from './historicoTarefa';
import { proximaExecucao } from './manutencao';
import { semResponsavel, tarefaDaPessoa } from './responsaveis';
import type { HistoricoPessoa, HistoricoTarefa, PessoaDocumentos, TarefaManutencao } from '../types';

export interface TarefasDeUmaPessoa {
  /** Id da pessoa, ou 'sem' para as tarefas sem responsável. */
  chave: string;
  nome: string;
  atrasadas: TarefaManutencao[];
  /** A próxima execução é hoje (as atrasadas não repetem aqui). */
  paraHoje: TarefaManutencao[];
}

/**
 * Tarefas atrasadas e de hoje, por pessoa. A tarefa do casal aparece para cada
 * um dos dois; a sem responsável vai para o grupo "Sem responsável" (só aparece
 * se tiver alguma). Pessoas sem nada pendente também aparecem, com listas vazias.
 */
export function tarefasPorPessoa(
  tarefas: TarefaManutencao[],
  pessoas: PessoaDocumentos[],
  membros: Map<string, string[]>,
  hoje: string
): TarefasDeUmaPessoa[] {
  const ativas = tarefas.filter((t) => t.ativo);
  const porNome = (a: TarefaManutencao, b: TarefaManutencao) => proximaExecucao(a).localeCompare(proximaExecucao(b)) || a.nome.localeCompare(b.nome, 'pt-BR');
  const dividir = (lista: TarefaManutencao[]) => ({
    atrasadas: lista.filter((t) => tarefaAtrasada(t, hoje)).sort(porNome),
    paraHoje: lista.filter((t) => !tarefaAtrasada(t, hoje) && proximaExecucao(t) === hoje).sort(porNome),
  });
  const grupos: TarefasDeUmaPessoa[] = pessoas.map((p) => ({ chave: p.id, nome: p.nome, ...dividir(ativas.filter((t) => tarefaDaPessoa(t, p.id, membros))) }));
  const sem = dividir(ativas.filter((t) => semResponsavel(t, membros)));
  if (sem.atrasadas.length > 0 || sem.paraHoje.length > 0) grupos.push({ chave: 'sem', nome: 'Sem responsável', ...sem });
  return grupos;
}

export interface EquilibrioDaPessoa {
  pessoaId: string;
  nome: string;
  /** Execuções em que só ela fez. */
  sozinha: number;
  /** Execuções feitas junto com outra pessoa. */
  junto: number;
  total: number;
}

export interface EquilibrioDoMes {
  /** Execuções do mês (cada uma conta uma vez, mesmo feita por duas pessoas). */
  execucoes: number;
  /** Execuções do mês sem ninguém marcado como quem fez. */
  semRegistro: number;
  pessoas: EquilibrioDaPessoa[];
}

/** Quem fez quantas tarefas num mês ("AAAA-MM"): sozinha, junto (conta para cada um) e as sem registro. */
export function equilibrioDoMes(
  historico: HistoricoTarefa[],
  historicoPessoas: HistoricoPessoa[],
  pessoas: PessoaDocumentos[],
  mes: string
): EquilibrioDoMes {
  const quemFez = new Map<string, string[]>();
  for (const h of historicoPessoas) quemFez.set(h.historico_id, [...(quemFez.get(h.historico_id) ?? []), h.pessoa_id]);
  const doMes = historico.filter((h) => h.data_execucao.slice(0, 7) === mes);
  const contagem = new Map(pessoas.map((p) => [p.id, { sozinha: 0, junto: 0 }]));
  let semRegistro = 0;
  for (const execucao of doMes) {
    const ids = (quemFez.get(execucao.id) ?? []).filter((id) => contagem.has(id));
    if (ids.length === 0) semRegistro++;
    for (const id of ids) {
      const c = contagem.get(id);
      if (!c) continue;
      if (ids.length === 1) c.sozinha++;
      else c.junto++;
    }
  }
  return {
    execucoes: doMes.length,
    semRegistro,
    pessoas: pessoas.map((p) => {
      const c = contagem.get(p.id) ?? { sozinha: 0, junto: 0 };
      return { pessoaId: p.id, nome: p.nome, sozinha: c.sozinha, junto: c.junto, total: c.sozinha + c.junto };
    }),
  };
}

