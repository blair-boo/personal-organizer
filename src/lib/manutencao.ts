import { hojeIso, somarDias } from './datas';
import type { TarefaManutencao } from '../types';

/** Dados da tarefa que entram no cálculo da próxima execução. */
export type DadosDeCiclo = Pick<TarefaManutencao, 'ultima_execucao' | 'frequencia_dias'> & {
  proxima_a_partir_de?: string | null;
  /** Adiamento ou "pular desta vez": vale como a próxima execução até a tarefa ser feita de novo. */
  adiada_ate?: string | null;
};

/**
 * Próxima execução: a data-base + frequência, ou hoje se nunca foi feita. A
 * data-base é a última execução, ou a data original do ciclo quando, depois de
 * um atraso, se escolheu voltar a ele (proxima_a_partir_de).
 */
export function proximaExecucao(tarefa: DadosDeCiclo): string {
  if (tarefa.adiada_ate) return tarefa.adiada_ate;
  const base = tarefa.proxima_a_partir_de ?? tarefa.ultima_execucao;
  if (!base) return hojeIso();
  return somarDias(base, tarefa.frequencia_dias);
}

/** Data para onde vai a tarefa quando se escolhe "pular desta vez": a próxima depois da prevista. */
export function dataAoPular(tarefa: DadosDeCiclo): string {
  return somarDias(proximaExecucao(tarefa), tarefa.frequencia_dias);
}

/** Todas as ocorrências futuras de uma tarefa recorrente dentro de [inicioIso, fimIso] (inclusive). */
export function ocorrenciasNoIntervalo(
  tarefa: DadosDeCiclo,
  inicioIso: string,
  fimIso: string
): string[] {
  const ocorrencias: string[] = [];
  let data = proximaExecucao(tarefa);
  // Segurança: nunca mais de 500 iterações (frequência mínima é 1 dia; intervalo típico é 1 mês).
  for (let i = 0; i < 500 && data <= fimIso; i++) {
    if (data >= inicioIso) ocorrencias.push(data);
    data = somarDias(data, tarefa.frequencia_dias);
  }
  return ocorrencias;
}
