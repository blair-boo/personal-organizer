import { tarefaAtrasada } from './historicoTarefa';
import { semResponsavel, tarefaDaPessoa } from './responsaveis';
import { proximaExecucao, type DadosDeCiclo } from './manutencao';
import type { TagItem, TarefaManutencao } from '../types';

export type StatusTarefa = 'feita' | 'nao_feita' | 'atrasada';

export interface FiltrosManutencao {
  /** Busca no nome da tarefa. */
  busca: string;
  /** Cômodos (classificações) ligados: a tarefa precisa estar em pelo menos um. */
  comodoIds: string[];
  /** Frequências ligadas, em dias: a tarefa precisa ter uma delas. */
  periodos: number[];
  /** Responsáveis ligados (id de pessoa, ou 'nenhum' para sem responsável): vale qualquer um. A tarefa do casal é de cada um dos dois. */
  responsaveis: string[];
  /** Dias da semana ligados: a tarefa precisa ter algum deles. */
  dias: number[];
  /** Situações ligadas (feita, não feita, atrasada): vale qualquer uma. Vazio = todas. */
  status: StatusTarefa[];
}

export type TipoFiltro = 'comodo' | 'frequencia' | 'responsavel' | 'status' | 'dia';

/** Tipos de filtro na ordem em que os botões aparecem. */
export const TIPOS_FILTRO: { tipo: TipoFiltro; rotulo: string }[] = [
  { tipo: 'comodo', rotulo: 'Cômodo' },
  { tipo: 'frequencia', rotulo: 'Frequência' },
  { tipo: 'responsavel', rotulo: 'Responsável' },
  { tipo: 'status', rotulo: 'Status' },
  { tipo: 'dia', rotulo: 'Dia da semana' },
];

/** Quantas opções estão ligadas em cada tipo de filtro (aparece ao lado do nome do botão). */
export function contarFiltrosDoTipo(f: FiltrosManutencao, tipo: TipoFiltro): number {
  switch (tipo) {
    case 'comodo':
      return f.comodoIds.length;
    case 'frequencia':
      return f.periodos.length;
    case 'responsavel':
      return f.responsaveis.length;
    case 'status':
      return f.status.length;
    case 'dia':
      return f.dias.length;
  }
}

export interface FiltrosSalvos {
  filtros: FiltrosManutencao;
  tiposAbertos: TipoFiltro[];
}

const CHAVE_FILTROS_SALVOS = 'po-tarefas-filtros';
const TIPOS_VALIDOS = new Set<string>(TIPOS_FILTRO.map((t) => t.tipo));

/** Lê o que ficou salvo no aparelho; qualquer problema (sem acesso, formato antigo) volta ao padrão. */
export function lerFiltrosSalvos(): FiltrosSalvos {
  const vazio: FiltrosSalvos = { filtros: FILTROS_VAZIOS, tiposAbertos: [] };
  try {
    const bruto = localStorage.getItem(CHAVE_FILTROS_SALVOS);
    if (!bruto) return vazio;
    const dado = JSON.parse(bruto) as Partial<{ filtros: Partial<FiltrosManutencao>; tiposAbertos: unknown }>;
    const lista = <T,>(v: unknown, ok: (x: unknown) => x is T): T[] => (Array.isArray(v) ? v.filter(ok) : []);
    const texto = (x: unknown): x is string => typeof x === 'string';
    const numero = (x: unknown): x is number => typeof x === 'number';
    const status = (x: unknown): x is StatusTarefa => x === 'feita' || x === 'nao_feita' || x === 'atrasada';
    return {
      // A busca por texto não é guardada: voltar com a lista filtrada por uma palavra antiga confunde.
      filtros: {
        busca: '',
        comodoIds: lista(dado.filtros?.comodoIds, texto),
        periodos: lista(dado.filtros?.periodos, numero),
        responsaveis: lista(dado.filtros?.responsaveis, texto),
        dias: lista(dado.filtros?.dias, numero),
        status: lista(dado.filtros?.status, status),
      },
      tiposAbertos: lista(dado.tiposAbertos, (x): x is TipoFiltro => texto(x) && TIPOS_VALIDOS.has(x)),
    };
  } catch {
    return vazio;
  }
}

export function guardarFiltros(salvos: FiltrosSalvos): void {
  try {
    localStorage.setItem(CHAVE_FILTROS_SALVOS, JSON.stringify({ filtros: { ...salvos.filtros, busca: '' }, tiposAbertos: salvos.tiposAbertos }));
  } catch {
    // Sem acesso ao armazenamento do navegador: os filtros só não ficam salvos.
  }
}

export const FILTROS_VAZIOS: FiltrosManutencao = { busca: '', comodoIds: [], periodos: [], dias: [], responsaveis: [], status: [] };

export function haFiltroAtivo(f: FiltrosManutencao): boolean {
  return f.busca.trim() !== '' || f.comodoIds.length > 0 || f.periodos.length > 0 || f.dias.length > 0 || f.responsaveis.length > 0 || f.status.length > 0;
}

/** Feita = já foi feita neste ciclo (a próxima execução está no futuro). Nunca feita, vencida ou para hoje = não feita. */
export function tarefaFeita(tarefa: DadosDeCiclo, hoje: string): boolean {
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
  hoje: string,
  membrosDosCasais: Map<string, string[]> = new Map()
): TarefaManutencao[] {
  const q = normalizar(filtros.busca);
  return tarefas.filter((tarefa) => {
    if (q && !normalizar(tarefa.nome).includes(q)) return false;
    if (filtros.comodoIds.length > 0) {
      const ids = (comodosPorTarefa.get(tarefa.id) ?? []).map((c) => c.id);
      if (!filtros.comodoIds.some((id) => ids.includes(id))) return false;
    }
    if (filtros.periodos.length > 0 && !filtros.periodos.includes(tarefa.frequencia_dias)) return false;
    if (filtros.responsaveis.length > 0) {
      const bate = filtros.responsaveis.some((r) => (r === 'nenhum' ? semResponsavel(tarefa, membrosDosCasais) : tarefaDaPessoa(tarefa, r, membrosDosCasais)));
      if (!bate) return false;
    }
    if (filtros.dias.length > 0 && !filtros.dias.some((d) => tarefa.dias_semana.includes(d))) return false;
    if (filtros.status.length > 0) {
      const feita = tarefaFeita(tarefa, hoje);
      const bate = filtros.status.some((s) => (s === 'feita' ? feita : s === 'nao_feita' ? !feita : tarefaAtrasada(tarefa, hoje)));
      if (!bate) return false;
    }
    return true;
  });
}
