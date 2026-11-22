import { describe, expect, it } from 'vitest';
import {
  FILTROS_VAZIOS,
  filtrarTarefas,
  haFiltroAtivo,
  inicioDaSemana,
  periodosDasTarefas,
  rotuloPeriodo,
  semanaDaTarefa,
  tarefaFeita,
} from './filtrosManutencao';
import type { TarefaManutencao } from '../types';

// 2026-11-18 é uma quarta-feira.
const HOJE = '2026-11-18';

function tarefa(id: string, nome: string, frequencia_dias: number, ultima_execucao: string | null): TarefaManutencao {
  return { id, nome, frequencia_dias, ultima_execucao, ativo: true };
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

describe('inicioDaSemana', () => {
  it('devolve a segunda-feira da semana (segunda a domingo)', () => {
    expect(inicioDaSemana('2026-11-18')).toBe('2026-11-16');
    expect(inicioDaSemana('2026-11-16')).toBe('2026-11-16');
    expect(inicioDaSemana('2026-11-22')).toBe('2026-11-16');
    expect(inicioDaSemana('2026-11-23')).toBe('2026-11-23');
  });
});

describe('semanaDaTarefa', () => {
  const t = (ultima: string | null, dias: number) => semanaDaTarefa({ ultima_execucao: ultima, frequencia_dias: dias }, HOJE);

  it('vencida cai em atrasadas', () => {
    expect(t('2026-11-01', 7)).toBe('atrasadas');
  });

  it('para hoje ou nunca feita cai nesta semana', () => {
    expect(t(null, 7)).toBe('esta');
    expect(t('2026-11-11', 7)).toBe('esta');
  });

  it('cai na semana certa pela data da próxima execução', () => {
    expect(t('2026-11-18', 4)).toBe('esta'); // domingo, dia 22
    expect(t('2026-11-18', 5)).toBe('proxima'); // segunda, dia 23
    expect(t('2026-11-18', 11)).toBe('proxima'); // domingo, dia 29
    expect(t('2026-11-18', 12)).toBe('em2'); // segunda, dia 30
    expect(t('2026-11-18', 14)).toBe('em2');
    expect(t('2026-11-18', 21)).toBe('em3');
    expect(t('2026-11-18', 60)).toBe('depois');
  });
});
