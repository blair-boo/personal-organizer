import { proximaExecucao } from './manutencao';
import type { ClassificacaoTarefa, TarefaManutencao } from '../types';

export type StatusTarefa = 'feita' | 'nao_feita';

export interface FiltrosManutencao {
  /** Busca no nome da tarefa. */
  busca: string;
  /** Cômodos (classificações) ligados: a tarefa precisa estar em pelo menos um. */
  comodoIds: string[];
  /** Frequências ligadas, em dias: a tarefa precisa ter uma delas. */
  periodos: number[];
  /** Feitas e/ou não feitas. Vazio ou os dois = todas. */
  status: StatusTarefa[];
}

export const FILTROS_VAZIOS: FiltrosManutencao = { busca: '', comodoIds: [], periodos: [], status: [] };

export function haFiltroAtivo(f: FiltrosManutencao): boolean {
  return f.busca.trim() !== '' || f.comodoIds.length > 0 || f.periodos.length > 0 || f.status.length > 0;
}

/** Feita = já foi feita neste ciclo (a próxima execução está no futuro). Nunca feita, vencida ou para hoje = não feita. */
export function tarefaFeita(tarefa: Pick<TarefaManutencao, 'ultima_execucao' | 'frequencia_dias'>, hoje: string): boolean {
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
  comodosPorTarefa: Map<string, Pick<ClassificacaoTarefa, 'id'>[]>,
  filtros: FiltrosManutencao,
  hoje: string
): TarefaManutencao[] {
  const q = normalizar(filtros.busca);
  const apenasFeitas = filtros.status.includes('feita') && !filtros.status.includes('nao_feita');
  const apenasNaoFeitas = filtros.status.includes('nao_feita') && !filtros.status.includes('feita');
  return tarefas.filter((tarefa) => {
    if (q && !normalizar(tarefa.nome).includes(q)) return false;
    if (filtros.comodoIds.length > 0) {
      const ids = (comodosPorTarefa.get(tarefa.id) ?? []).map((c) => c.id);
      if (!filtros.comodoIds.some((id) => ids.includes(id))) return false;
    }
    if (filtros.periodos.length > 0 && !filtros.periodos.includes(tarefa.frequencia_dias)) return false;
    if (apenasFeitas || apenasNaoFeitas) {
      const feita = tarefaFeita(tarefa, hoje);
      if (apenasFeitas && !feita) return false;
      if (apenasNaoFeitas && feita) return false;
    }
    return true;
  });
}
