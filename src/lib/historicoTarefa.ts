import { somarDias } from './datas';
import { proximaExecucao, type DadosDeCiclo } from './manutencao';
import type { BaseProximaExecucao, HistoricoTarefa } from '../types';

type Entrada = Pick<HistoricoTarefa, 'data_execucao' | 'data_prevista' | 'base_proxima'> & Partial<Pick<HistoricoTarefa, 'criado_em'>>;

/** Foi feita depois da data em que deveria. */
export function entradaAtrasada(entrada: Pick<HistoricoTarefa, 'data_execucao' | 'data_prevista'>): boolean {
  return entrada.data_prevista !== null && entrada.data_execucao > entrada.data_prevista;
}

/** Data de onde conta a próxima execução: a do ciclo original (se foi escolhida e existe) ou a do dia em que foi feita. */
export function baseDaEntrada(entrada: Entrada): string {
  return entrada.base_proxima === 'prevista' && entrada.data_prevista ? entrada.data_prevista : entrada.data_execucao;
}

/** A execução mais recente (empate no dia: a registrada por último). */
export function ultimaEntrada<T extends Entrada>(entradas: T[]): T | null {
  let melhor: T | null = null;
  for (const e of entradas) {
    if (!melhor || e.data_execucao > melhor.data_execucao || (e.data_execucao === melhor.data_execucao && (e.criado_em ?? '') > (melhor.criado_em ?? ''))) {
      melhor = e;
    }
  }
  return melhor;
}

/** O que a tarefa guarda a partir do histórico: última execução e, se a base for outra, a data-base. */
export function resumoDoHistorico(entradas: Entrada[]): { ultima_execucao: string | null; proxima_a_partir_de: string | null } {
  const ultima = ultimaEntrada(entradas);
  if (!ultima) return { ultima_execucao: null, proxima_a_partir_de: null };
  const base = baseDaEntrada(ultima);
  return { ultima_execucao: ultima.data_execucao, proxima_a_partir_de: base === ultima.data_execucao ? null : base };
}

/** Quando a tarefa deveria ser feita agora; null se nunca foi feita (nada a atrasar). */
export function dataPrevistaDaTarefa(tarefa: DadosDeCiclo): string | null {
  return tarefa.ultima_execucao ? proximaExecucao(tarefa) : null;
}

/** Está atrasada hoje: tinha data prevista e ela já passou. */
export function tarefaAtrasada(tarefa: DadosDeCiclo, hoje: string): boolean {
  const prevista = dataPrevistaDaTarefa(tarefa);
  return prevista !== null && prevista < hoje;
}

/**
 * Data prevista de uma execução incluída à mão: a execução anterior a ela,
 * contando da base dela, mais a frequência. Sem execução anterior, null (não conta como atrasada).
 */
export function dataPrevistaParaNova(entradas: Entrada[], dataExecucao: string, frequenciaDias: number): string | null {
  const anteriores = entradas.filter((e) => e.data_execucao < dataExecucao);
  const anterior = ultimaEntrada(anteriores);
  return anterior ? somarDias(baseDaEntrada(anterior), frequenciaDias) : null;
}

export const ROTULOS_BASE: Record<BaseProximaExecucao, string> = {
  execucao: 'A partir do dia em que foi feita',
  prevista: 'Voltar à data original',
};
