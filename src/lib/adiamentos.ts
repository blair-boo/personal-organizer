import type { AdiamentoTarefa } from '../types';

/** Atalhos do modal de adiar: quantos dias a partir de hoje (ou da próxima execução, se for mais tarde). */
export const ATALHOS_ADIAR: { rotulo: string; dias: number }[] = [
  { rotulo: 'Amanhã', dias: 1 },
  { rotulo: 'Daqui a 3 dias', dias: 3 },
  { rotulo: 'Próxima semana', dias: 7 },
];

/** A partir de quantos adiamentos desde a última execução a tarefa ganha o aviso. */
export const LIMITE_AVISO_ADIAMENTOS = 3;

/** Adiamentos de uma tarefa, do mais recente para o mais antigo. */
export function adiamentosDaTarefa(adiamentos: AdiamentoTarefa[], tarefaId: string): AdiamentoTarefa[] {
  return adiamentos.filter((a) => a.tarefa_id === tarefaId).sort((a, b) => b.criado_em.localeCompare(a.criado_em));
}

/** O adiamento que está valendo: o mais recente, desde que a tarefa ainda esteja adiada para a mesma data. */
export function adiamentoVigente(adiamentosDaTarefaOrdenados: AdiamentoTarefa[], adiadaAte: string | null): AdiamentoTarefa | null {
  if (!adiadaAte) return null;
  const ultimo = adiamentosDaTarefaOrdenados[0];
  return ultimo && ultimo.tipo !== 'cancelada' && ultimo.adiada_para === adiadaAte ? ultimo : null;
}

/** Quantas vezes a tarefa foi adiada ou pulada desde a última vez em que foi feita (cancelar não conta). */
export function vezesAdiadaDesdeUltimaExecucao(adiamentosDaTarefaOrdenados: AdiamentoTarefa[], ultimaExecucao: string | null): number {
  return adiamentosDaTarefaOrdenados.filter((a) => a.tipo !== 'cancelada' && (!ultimaExecucao || a.criado_em.slice(0, 10) > ultimaExecucao)).length;
}

export const ROTULOS_TIPO_ADIAMENTO: Record<AdiamentoTarefa['tipo'], string> = {
  adiada: 'Adiada',
  pulada: 'Pulada',
  cancelada: 'Adiamento cancelado',
};
