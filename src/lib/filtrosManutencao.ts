import { tarefaAtrasada } from './historicoTarefa';
import { proximaExecucao } from './manutencao';
import type { TagItem, TarefaManutencao } from '../types';

export type StatusTarefa = 'feita' | 'nao_feita' | 'atrasada';

export interface FiltrosManutencao {
  /** Busca no nome da tarefa. */
  busca: string;
  /** Cômodos (classificações) ligados: a tarefa precisa estar em pelo menos um. */
  comodoIds: string[];
  /** Frequências ligadas, em dias: a tarefa precisa ter uma delas. */
  periodos: number[];
  /** Situações ligadas (feita, não feita, atrasada): vale qualquer uma. Vazio = todas. */
  status: StatusTarefa[];
}

export const FILTROS_VAZIOS: FiltrosManutencao = { busca: '', comodoIds: [], periodos: [], status: [] };

export function haFiltroAtivo(f: FiltrosManutencao): boolean {
  return f.busca.trim() !== '' || f.comodoIds.length > 0 || f.periodos.length > 0 || f.status.length > 0;
}

/** Feita = já foi feita neste ciclo (a próxima execução está no futuro). Nunca feita, vencida ou para hoje = não feita. */
export function tarefaFeita(tarefa: Pick<TarefaManutencao, 'ultima_execucao' | 'frequencia_dias' | 'proxima_a_partir_de'>, hoje: string): boolean {
  return tarefa.ultima_execucao !== null && proximaExecucao(tarefa) > hoje;
}

const ROTULOS_PERIODO: Record<number, string> = {
  1: 'Diária',
  7: 'Semanal',
  15: 'Quinzenal',
  30: 'Mensal',
  60: 'Bimestral',
  90: 'Trimestral',
  120: 'A cada 4 meses',
  180: 'Semestral',
  365: 'Anual',
  730: 'A cada 2 anos',
};

export function rotuloPeriodo(dias: number): string {
  return ROTULOS_PERIODO[dias] ?? `A cada ${dias} dias`;
}

/** Frequências que existem nas tarefas, da mais curta para a mais longa. */
export function periodosDasTarefas(tarefas: Pick<TarefaManutencao, 'frequencia_dias'>[]): number[] {
  return [...new Set(tarefas.map((t) => t.frequencia_dias))].sort((a, b) => a - b);
}

function normalizar(texto: string): string {
  return texto.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
}

/** Dentro de cada grupo vale "ou"; entre grupos vale "e". Grupo sem nada ligado não filtra. */
export function filtrarTarefas(
  tarefas: TarefaManutencao[],
  comodosPorTarefa: Map<string, Pick<TagItem, 'id'>[]>,
  filtros: FiltrosManutencao,
  hoje: string
): TarefaManutencao[] {
  const q = normalizar(filtros.busca);
  return tarefas.filter((tarefa) => {
    if (q && !normalizar(tarefa.nome).includes(q)) return false;
    if (filtros.comodoIds.length > 0) {
      const ids = (comodosPorTarefa.get(tarefa.id) ?? []).map((c) => c.id);
      if (!filtros.comodoIds.some((id) => ids.includes(id))) return false;
    }
    if (filtros.periodos.length > 0 && !filtros.periodos.includes(tarefa.frequencia_dias)) return false;
    if (filtros.status.length > 0) {
      const feita = tarefaFeita(tarefa, hoje);
      const bate = filtros.status.some((s) => (s === 'feita' ? feita : s === 'nao_feita' ? !feita : tarefaAtrasada(tarefa, hoje)));
      if (!bate) return false;
    }
    return true;
  });
}
