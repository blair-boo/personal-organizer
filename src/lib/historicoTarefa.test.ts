import { describe, expect, it } from 'vitest';
import {
  baseDaEntrada,
  dataPrevistaDaTarefa,
  dataPrevistaParaNova,
  entradaAtrasada,
  resumoDoHistorico,
  tarefaAtrasada,
  ultimaEntrada,
} from './historicoTarefa';
import { proximaExecucao } from './manutencao';

const e = (data_execucao: string, data_prevista: string | null, base_proxima: 'execucao' | 'prevista' = 'execucao', criado_em = '') => ({
  data_execucao,
  data_prevista,
  base_proxima,
  criado_em,
});

describe('entradaAtrasada e baseDaEntrada', () => {
  it('atrasada só quando feita depois da data prevista', () => {
    expect(entradaAtrasada(e('2026-11-10', '2026-11-05'))).toBe(true);
    expect(entradaAtrasada(e('2026-11-05', '2026-11-05'))).toBe(false);
    expect(entradaAtrasada(e('2026-11-01', '2026-11-05'))).toBe(false); // adiantada
    expect(entradaAtrasada(e('2026-11-10', null))).toBe(false);
  });

  it('base: a data original só quando escolhida e existente', () => {
    expect(baseDaEntrada(e('2026-11-10', '2026-11-05', 'prevista'))).toBe('2026-11-05');
    expect(baseDaEntrada(e('2026-11-10', '2026-11-05', 'execucao'))).toBe('2026-11-10');
    expect(baseDaEntrada(e('2026-11-10', null, 'prevista'))).toBe('2026-11-10');
  });
});

describe('ultimaEntrada e resumoDoHistorico', () => {
  it('pega a de data mais recente, e no empate a registrada por último', () => {
    const lista = [e('2026-10-01', null, 'execucao', 'a'), e('2026-11-01', null, 'execucao', 'b'), e('2026-11-01', null, 'prevista', 'c')];
    expect(ultimaEntrada(lista)).toBe(lista[2]);
    expect(ultimaEntrada([])).toBeNull();
  });

  it('sem histórico a tarefa fica sem execução', () => {
    expect(resumoDoHistorico([])).toEqual({ ultima_execucao: null, proxima_a_partir_de: null });
  });

  it('base na própria execução não precisa de data-base separada', () => {
    expect(resumoDoHistorico([e('2026-11-10', '2026-11-05', 'execucao')])).toEqual({ ultima_execucao: '2026-11-10', proxima_a_partir_de: null });
  });

  it('voltar ao ciclo original guarda a data prevista como base', () => {
    expect(resumoDoHistorico([e('2026-11-10', '2026-11-05', 'prevista')])).toEqual({ ultima_execucao: '2026-11-10', proxima_a_partir_de: '2026-11-05' });
  });

  it('só a mais recente define a base', () => {
    const r = resumoDoHistorico([e('2026-10-10', '2026-10-05', 'prevista'), e('2026-11-10', '2026-11-12', 'execucao')]);
    expect(r).toEqual({ ultima_execucao: '2026-11-10', proxima_a_partir_de: null });
  });
});

describe('próxima execução com a data-base', () => {
  it('mensal feita com 5 dias de atraso: a partir de hoje ou do ciclo original', () => {
    // devia ser 05/12 (última 05/11 + 30); foi feita 10/12
    const aPartirDeHoje = { ultima_execucao: '2026-12-10', proxima_a_partir_de: null, frequencia_dias: 30 };
    const cicloOriginal = { ultima_execucao: '2026-12-10', proxima_a_partir_de: '2026-12-05', frequencia_dias: 30 };
    expect(proximaExecucao(aPartirDeHoje)).toBe('2027-01-09');
    expect(proximaExecucao(cicloOriginal)).toBe('2027-01-04');
  });
});

describe('dataPrevistaDaTarefa e tarefaAtrasada', () => {
  const base = { frequencia_dias: 30, proxima_a_partir_de: null };

  it('nunca feita: sem data prevista e nunca atrasada', () => {
    const t = { ...base, ultima_execucao: null };
    expect(dataPrevistaDaTarefa(t)).toBeNull();
    expect(tarefaAtrasada(t, '2026-11-18')).toBe(false);
  });

  it('atrasada só depois do dia previsto', () => {
    const t = { ...base, ultima_execucao: '2026-10-19' }; // prevista 2026-11-18
    expect(tarefaAtrasada(t, '2026-11-18')).toBe(false);
    expect(tarefaAtrasada(t, '2026-11-19')).toBe(true);
  });
});

describe('dataPrevistaParaNova', () => {
  it('conta da base da execução anterior mais a frequência', () => {
    const lista = [e('2026-10-01', null), e('2026-11-10', '2026-10-31', 'prevista')];
    expect(dataPrevistaParaNova(lista, '2026-12-20', 30)).toBe('2026-11-30');
    expect(dataPrevistaParaNova(lista, '2026-10-20', 30)).toBe('2026-10-31');
  });

  it('sem execução anterior não há data prevista', () => {
    expect(dataPrevistaParaNova([e('2026-10-01', null)], '2026-09-01', 30)).toBeNull();
    expect(dataPrevistaParaNova([], '2026-09-01', 30)).toBeNull();
  });
});
