import { hojeIso, somarDias } from './datas';
import type { TarefaManutencao } from '../types';

/** Próxima execução: última execução + frequência, ou hoje se nunca foi feita. */
export function proximaExecucao(tarefa: Pick<TarefaManutencao, 'ultima_execucao' | 'frequencia_dias'>): string {
  if (!tarefa.ultima_execucao) return hojeIso();
  return somarDias(tarefa.ultima_execucao, tarefa.frequencia_dias);
}

/** Todas as ocorrências futuras de uma tarefa recorrente dentro de [inicioIso, fimIso] (inclusive). */
export function ocorrenciasNoIntervalo(
  tarefa: Pick<TarefaManutencao, 'ultima_execucao' | 'frequencia_dias'>,
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
