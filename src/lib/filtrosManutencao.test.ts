import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  FILTROS_VAZIOS,
  contarFiltrosDoTipo,
  filtrarTarefas,
  guardarFiltros,
  lerFiltrosSalvos,
  haFiltroAtivo,
  periodosDasTarefas,
  rotuloPeriodo,
  tarefaFeita,
} from './filtrosManutencao';
import type { TarefaManutencao } from '../types';

// 2026-11-18 é uma quarta-feira.
const HOJE = '2026-11-18';

function tarefa(id: string, nome: string, frequencia_dias: number, ultima_execucao: string | null): TarefaManutencao {
  return { id, nome, frequencia_dias, ultima_execucao, proxima_a_partir_de: null, adiada_ate: null, responsavel_tipo: 'nenhum', responsavel_pessoa_id: null, responsavel_casal_id: null, dias_semana: id === 't2' ? [0, 4] : [], instrucoes: null, ativo: true };
}

const tarefas = [
  tarefa('t1', 'Limpar a Pia', 1, '2026-11-18'), // feita hoje, próxima amanhã
  tarefa('t2', 'Box do banheiro', 7, null), // nunca feita
  tarefa('t3', 'Limpar o forno', 120, '2026-06-01'), // vencida desde 29/09
  tarefa('t4', 'Repintar as paredes', 730, '2026-01-01'), // feita, longe
];
const comodos = new Map([
  ['t1', [{ id: 'cozinha' }]],
  ['t2', [{ id: 'banheiro' }]],
  ['t3', [{ id: 'cozinha' }, { id: 'geral' }]],
]);

const filtrar = (f: Partial<typeof FILTROS_VAZIOS>) => filtrarTarefas(tarefas, comodos, { ...FILTROS_VAZIOS, ...f }, HOJE).map((t) => t.id);

describe('tarefaFeita', () => {
  it('só conta como feita quando a próxima execução está no futuro', () => {
    expect(tarefaFeita(tarefas[0], HOJE)).toBe(true);
    expect(tarefaFeita(tarefas[1], HOJE)).toBe(false);
    expect(tarefaFeita(tarefas[2], HOJE)).toBe(false);
    expect(tarefaFeita(tarefas[3], HOJE)).toBe(true);
  });

  it('feita no dia em que vence de novo volta a ser não feita', () => {
    expect(tarefaFeita(tarefa('x', 'x', 1, '2026-11-17'), HOJE)).toBe(false);
  });
});

describe('filtrarTarefas', () => {
  it('sem filtro devolve tudo', () => {
    expect(filtrar({})).toEqual(['t1', 't2', 't3', 't4']);
    expect(haFiltroAtivo(FILTROS_VAZIOS)).toBe(false);
  });

  it('busca só no nome, sem acento nem maiúscula', () => {
    expect(filtrar({ busca: 'BANHEIRO' })).toEqual(['t2']);
    expect(filtrar({ busca: 'cozinha' })).toEqual([]);
    expect(haFiltroAtivo({ ...FILTROS_VAZIOS, busca: 'a' })).toBe(true);
  });

  it('cômodos: vale qualquer um dos ligados', () => {
    expect(filtrar({ comodoIds: ['cozinha'] })).toEqual(['t1', 't3']);
    expect(filtrar({ comodoIds: ['cozinha', 'banheiro'] })).toEqual(['t1', 't2', 't3']);
    expect(filtrar({ comodoIds: ['geral'] })).toEqual(['t3']);
  });

  it('períodos: vale qualquer um dos ligados', () => {
    expect(filtrar({ periodos: [1, 730] })).toEqual(['t1', 't4']);
  });

  it('feitas e não feitas', () => {
    expect(filtrar({ status: ['feita'] })).toEqual(['t1', 't4']);
    expect(filtrar({ status: ['nao_feita'] })).toEqual(['t2', 't3']);
    expect(filtrar({ status: ['feita', 'nao_feita'] })).toEqual(['t1', 't2', 't3', 't4']);
    // t3 venceu em 29/09; t2 nunca foi feita (para hoje, não atrasada)
    expect(filtrar({ status: ['atrasada'] })).toEqual(['t3']);
    expect(filtrar({ status: ['atrasada', 'feita'] })).toEqual(['t1', 't3', 't4']);
  });

  it('dias da semana: vale qualquer um dos ligados', () => {
    expect(filtrar({ dias: [0] })).toEqual(['t2']);
    expect(filtrar({ dias: [4, 6] })).toEqual(['t2']);
    expect(filtrar({ dias: [2] })).toEqual([]);
    expect(haFiltroAtivo({ ...FILTROS_VAZIOS, dias: [1] })).toBe(true);
  });

  it('responsáveis: a tarefa do casal é de cada um dos dois, e dá para filtrar as sem responsável', () => {
    const membros = new Map([['c', ['e', 'm']]]);
    const lista = [
      { ...tarefa('r1', 'Da Mariana', 7, null), responsavel_tipo: 'pessoa' as const, responsavel_pessoa_id: 'm' },
      { ...tarefa('r2', 'Do casal', 7, null), responsavel_tipo: 'juntos' as const, responsavel_casal_id: 'c' },
      tarefa('r3', 'Sem dono', 7, null),
    ];
    const f = (responsaveis: string[]) => filtrarTarefas(lista, comodos, { ...FILTROS_VAZIOS, responsaveis }, HOJE, membros).map((t) => t.id);
    expect(f(['m'])).toEqual(['r1', 'r2']);
    expect(f(['e'])).toEqual(['r2']);
    expect(f(['nenhum'])).toEqual(['r3']);
    expect(f(['e', 'nenhum'])).toEqual(['r2', 'r3']);
    expect(haFiltroAtivo({ ...FILTROS_VAZIOS, responsaveis: ['m'] })).toBe(true);
  });

  it('entre grupos vale "e"', () => {
    expect(filtrar({ comodoIds: ['cozinha'], status: ['nao_feita'] })).toEqual(['t3']);
    expect(filtrar({ comodoIds: ['cozinha'], periodos: [1], status: ['feita'] })).toEqual(['t1']);
    expect(filtrar({ comodoIds: ['banheiro'], periodos: [30] })).toEqual([]);
  });
});

describe('rotuloPeriodo e periodosDasTarefas', () => {
  it('nomeia as frequências conhecidas e as demais em dias', () => {
    expect(rotuloPeriodo(7)).toBe('Semanal');
    expect(rotuloPeriodo(120)).toBe('A cada 4 meses');
    expect(rotuloPeriodo(45)).toBe('A cada 45 dias');
  });

  it('lista as frequências sem repetir, da menor para a maior', () => {
    expect(periodosDasTarefas(tarefas)).toEqual([1, 7, 120, 730]);
  });
});

describe('filtros por tipo e persistência', () => {
  const guardado = new Map<string, string>();
  beforeEach(() => {
    guardado.clear();
    vi.stubGlobal('localStorage', {
      getItem: (k: string) => guardado.get(k) ?? null,
      setItem: (k: string, v: string) => void guardado.set(k, v),
    });
  });
  afterEach(() => vi.unstubAllGlobals());

  it('conta as opções ligadas de cada tipo', () => {
    const f = { ...FILTROS_VAZIOS, comodoIds: ['a', 'b'], dias: [0], status: ['atrasada' as const] };
    expect(contarFiltrosDoTipo(f, 'comodo')).toBe(2);
    expect(contarFiltrosDoTipo(f, 'dia')).toBe(1);
    expect(contarFiltrosDoTipo(f, 'status')).toBe(1);
    expect(contarFiltrosDoTipo(f, 'frequencia')).toBe(0);
    expect(contarFiltrosDoTipo(f, 'responsavel')).toBe(0);
  });

  it('guarda e lê os filtros e os tipos abertos, sem a busca', () => {
    guardarFiltros({ filtros: { ...FILTROS_VAZIOS, busca: 'forno', periodos: [30], responsaveis: ['p1'] }, tiposAbertos: ['frequencia', 'responsavel'] });
    expect(lerFiltrosSalvos()).toEqual({ filtros: { ...FILTROS_VAZIOS, periodos: [30], responsaveis: ['p1'] }, tiposAbertos: ['frequencia', 'responsavel'] });
  });

  it('ignora dado salvo estragado ou de tipo desconhecido', () => {
    guardado.set('po-tarefas-filtros', '{"filtros":{"periodos":["x",7]},"tiposAbertos":["comodo","nada"]}');
    expect(lerFiltrosSalvos()).toEqual({ filtros: { ...FILTROS_VAZIOS, periodos: [7] }, tiposAbertos: ['comodo'] });
    guardado.set('po-tarefas-filtros', 'não é json');
    expect(lerFiltrosSalvos()).toEqual({ filtros: FILTROS_VAZIOS, tiposAbertos: [] });
  });
});
