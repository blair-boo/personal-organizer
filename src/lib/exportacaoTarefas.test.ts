import { describe, expect, it } from 'vitest';
import {
  blocoDaFrequencia,
  marcasPorDia,
  marcasPorMes,
  nomeDoArquivoDeTarefas,
  planilhaDados,
  planilhaDiaria,
  planilhaPeriodica,
  type DadosExportacao,
} from './exportacaoTarefas';
import type { HistoricoTarefa, TarefaManutencao } from '../types';

const HOJE = '2026-11-22'; // domingo

function tarefa(id: string, nome: string, frequencia_dias: number, ultima_execucao: string | null, extra: Partial<TarefaManutencao> = {}): TarefaManutencao {
  return { id, nome, frequencia_dias, ultima_execucao, proxima_a_partir_de: null, dias_semana: [], instrucoes: null, ativo: true, ...extra };
}

function exec(id: string, tarefa_id: string, data_execucao: string, data_prevista: string | null, base_proxima: 'execucao' | 'prevista' = 'execucao'): HistoricoTarefa {
  return { id, tarefa_id, data_execucao, data_prevista, base_proxima, observacao: null, criado_em: `${data_execucao}T10:00:00Z` };
}

describe('blocoDaFrequencia', () => {
  it('liga cada frequência ao bloco do Esqueleto', () => {
    expect(blocoDaFrequencia(1)).toBe('Daily');
    expect(blocoDaFrequencia(7)).toBe('Weekly');
    expect(blocoDaFrequencia(15)).toBe('Every 15 Days');
    expect(blocoDaFrequencia(30)).toBe('Monthly');
    expect(blocoDaFrequencia(60)).toBe('Bi-Monthly');
    expect(blocoDaFrequencia(90)).toBe('Quarterly or Every 4-Months');
    expect(blocoDaFrequencia(120)).toBe('Quarterly or Every 4-Months');
    expect(blocoDaFrequencia(180)).toBe('Bi Annual');
    expect(blocoDaFrequencia(365)).toBe('Annual');
    expect(blocoDaFrequencia(730)).toBe('2 Years');
  });

  it('frequência fora da lista não cai em bloco nenhum', () => {
    expect(blocoDaFrequencia(45)).toBeNull();
    expect(blocoDaFrequencia(10)).toBeNull();
  });
});

describe('marcasPorMes', () => {
  it('feita no prazo é verde com o dia; fora do prazo é vermelha só no mês em que foi feita', () => {
    const t = tarefa('t1', 'Forno', 30, '2026-03-21');
    const marcas = marcasPorMes(t, [exec('a', 't1', '2026-01-12', '2026-01-12'), exec('b', 't1', '2026-03-21', '2026-03-12')], 2026);
    expect(marcas.get(1)).toEqual({ tipo: 'due', dia: 12 });
    expect(marcas.get(3)).toEqual({ tipo: 'over', dia: 21 });
    expect(marcas.get(2)).toBeUndefined(); // sem execução nem vencimento: vazio
  });

  it('os meses que ainda vencem ficam verdes com o dia previsto, e os passados sem execução ficam vazios', () => {
    const t = tarefa('t1', 'Forno', 30, '2026-11-05'); // próxima 05/12
    const marcas = marcasPorMes(t, [exec('a', 't1', '2026-11-05', '2026-11-05')], 2026);
    expect(marcas.get(11)).toEqual({ tipo: 'due', dia: 5 });
    expect(marcas.get(12)).toEqual({ tipo: 'due', dia: 5 });
    expect(marcas.get(10)).toBeUndefined();
  });

  it('atrasada e ainda não feita aparece verde, com o dia previsto, no mês em que venceu', () => {
    const t = tarefa('t1', 'Cortinas', 30, '2026-09-05'); // próxima 05/10, passou
    const marcas = marcasPorMes(t, [exec('a', 't1', '2026-09-05', '2026-09-05')], 2026);
    expect(marcas.get(10)).toEqual({ tipo: 'due', dia: 5 });
    expect(marcas.get(9)).toEqual({ tipo: 'due', dia: 5 });
  });

  it('nunca feita começa a valer no mês de hoje', () => {
    const t = tarefa('t1', 'Nova', 30, null);
    const marcas = marcasPorMes(t, [], new Date().getFullYear());
    expect(marcas.size).toBeGreaterThan(0);
    expect([...marcas.values()].every((m) => m.tipo === 'due')).toBe(true);
  });

  it('com mais de uma execução no mês vale a mais recente', () => {
    const t = tarefa('t1', 'X', 30, '2026-05-20');
    const marcas = marcasPorMes(t, [exec('a', 't1', '2026-05-02', '2026-05-02'), exec('b', 't1', '2026-05-20', '2026-05-02')], 2026);
    expect(marcas.get(5)).toEqual({ tipo: 'over', dia: 20 });
  });

  it('ano passado só mostra o que foi feito', () => {
    const t = tarefa('t1', 'X', 30, '2026-05-20');
    const marcas = marcasPorMes(t, [exec('a', 't1', '2025-12-03', '2025-12-03'), exec('b', 't1', '2026-05-20', null)], 2025);
    expect([...marcas.keys()]).toEqual([12]);
  });
});

describe('marcasPorDia', () => {
  it('diária: dias feitos e os que ainda vêm, um por dia', () => {
    const t = tarefa('t1', 'Aspirar', 1, HOJE);
    const marcas = marcasPorDia(t, [exec('a', 't1', '2026-11-20', '2026-11-20'), exec('b', 't1', HOJE, HOJE)], 2026, 11, HOJE);
    expect(marcas.get(20)).toEqual({ tipo: 'due', dia: 20 });
    expect(marcas.get(22)).toEqual({ tipo: 'due', dia: 22 });
    expect(marcas.get(23)).toEqual({ tipo: 'due', dia: 23 });
    expect(marcas.get(30)).toEqual({ tipo: 'due', dia: 30 });
    expect(marcas.get(10)).toBeUndefined();
  });

  it('diária feita com atraso fica vermelha só naquele dia', () => {
    const t = tarefa('t1', 'Louças', 1, '2026-11-12');
    const marcas = marcasPorDia(t, [exec('a', 't1', '2026-11-12', '2026-11-10')], 2026, 11, HOJE);
    expect(marcas.get(12)).toEqual({ tipo: 'over', dia: 12 });
  });

  it('semanal sem dias da semana avança de 7 em 7 a partir da próxima', () => {
    const t = tarefa('t1', 'Box', 7, '2026-11-20'); // próxima 27/11
    const marcas = marcasPorDia(t, [exec('a', 't1', '2026-11-20', '2026-11-20')], 2026, 11, HOJE);
    expect(marcas.get(27)).toEqual({ tipo: 'due', dia: 27 });
    expect(marcas.get(20)).toEqual({ tipo: 'due', dia: 20 });
    expect(marcas.get(23)).toBeUndefined();
  });

  it('semanal com dias da semana usa esses dias de hoje em diante', () => {
    // segunda (0) e sexta (4); hoje é domingo 22/11
    const t = tarefa('t1', 'Trocar toalhas', 7, '2026-11-20', { dias_semana: [0, 4] });
    const marcas = marcasPorDia(t, [], 2026, 11, HOJE);
    expect([...marcas.keys()].sort((a, b) => a - b)).toEqual([23, 27, 30]);
  });

  it('semanal com dia da semana não marca também a data do ciclo que cai em outro dia', () => {
    // só segunda (0); o ciclo cairia numa sexta (27/11), que não é dia dela
    const t = tarefa('t1', 'Box', 7, '2026-11-20', { dias_semana: [0] });
    const marcas = marcasPorDia(t, [], 2026, 11, HOJE);
    expect([...marcas.keys()].sort((a, b) => a - b)).toEqual([23, 30]);
  });

  it('semanal atrasada com dia da semana mostra também a data do ciclo que passou', () => {
    const t = tarefa('t1', 'Box', 7, '2026-11-10', { dias_semana: [0] }); // ciclo em 17/11, já passou
    const marcas = marcasPorDia(t, [], 2026, 11, HOJE);
    expect([...marcas.keys()].sort((a, b) => a - b)).toEqual([17, 23, 30]);
  });

  it('só olha o mês pedido', () => {
    const t = tarefa('t1', 'Aspirar', 1, HOJE);
    expect(marcasPorDia(t, [exec('a', 't1', '2026-10-30', '2026-10-30')], 2026, 11, HOJE).get(30)).toEqual({ tipo: 'due', dia: 30 });
    expect(marcasPorDia(t, [exec('a', 't1', '2026-10-30', '2026-10-30')], 2026, 10, HOJE).get(30)).toEqual({ tipo: 'due', dia: 30 });
  });
});

const dados = (): DadosExportacao => ({
  tarefas: [
    tarefa('t1', 'Limpar o forno', 30, '2026-11-05'),
    tarefa('t2', 'Box do banheiro', 7, '2026-11-20', { dias_semana: [0] }),
    tarefa('t3', 'Aspirar a casa', 1, HOJE),
    tarefa('t4', 'Repintar as paredes', 730, null),
    tarefa('t5', 'Quinzenal', 15, null),
    tarefa('t7', 'A cada 45 dias', 45, null),
    tarefa('t6', 'Outra mensal', 30, '2026-11-01'),
  ],
  historico: [exec('h1', 't1', '2026-11-05', '2026-11-05')],
  comodosPorTarefa: new Map([
    ['t1', [{ nome: 'Cozinha' }]],
    ['t2', [{ nome: 'Banheiro' }]],
    ['t4', [{ nome: 'Geral (sem cômodo)' }, { nome: 'Sala de Estar' }]],
  ]),
  hoje: HOJE,
});

describe('planilhaPeriodica', () => {
  it('começa pela legenda e põe um bloco por frequência, só os que têm tarefa', () => {
    const { grade } = planilhaPeriodica(dados(), { ano: 2026, mes: 11, comComodo: false });
    expect(grade[0].map((c) => c.valor)).toEqual(['Household Tasks', 'DUE', 'OVERDUE']);
    const blocos = grade.filter((l) => l[0]?.estilo === 'bloco').map((l) => l[0].valor);
    expect(blocos).toEqual(['Monthly', '2 Years']);
  });

  it('cabeçalho do bloco tem os 12 meses como data, e cada linha tem 12 células depois do nome', () => {
    const { grade } = planilhaPeriodica(dados(), { ano: 2026, mes: 11, comComodo: false });
    const cabecalho = grade.find((l) => l[0]?.valor === 'Monthly')!;
    expect(cabecalho).toHaveLength(13);
    expect((cabecalho[1].valor as Date).toISOString().slice(0, 10)).toBe('2026-01-01');
    expect((cabecalho[12].valor as Date).toISOString().slice(0, 10)).toBe('2026-12-01');
    const linha = grade.find((l) => l[0]?.valor === 'Limpar o forno')!;
    expect(linha).toHaveLength(13);
    expect(linha[11]).toEqual({ valor: 5, estilo: 'due' }); // novembro, feita
    expect(linha[12]).toEqual({ valor: 5, estilo: 'due' }); // dezembro, ainda vence
    expect(linha[1]).toEqual({ valor: null, estilo: 'vazia' });
  });

  it('ordena por cômodo e depois por nome, e sem cômodo vai por último', () => {
    const { grade } = planilhaPeriodica(dados(), { ano: 2026, mes: 11, comComodo: false });
    const nomes = grade.filter((l) => l[0]?.estilo === 'nome').map((l) => l[0].valor);
    // Monthly: Limpar o forno (Cozinha) antes de Outra mensal (sem cômodo); depois 2 Years
    expect(nomes).toEqual(['Limpar o forno', 'Outra mensal', 'Repintar as paredes']);
  });

  it('o cômodo no nome da linha é opcional', () => {
    const sem = planilhaPeriodica(dados(), { ano: 2026, mes: 11, comComodo: false }).grade.flat().map((c) => c.valor);
    const com = planilhaPeriodica(dados(), { ano: 2026, mes: 11, comComodo: true }).grade.flat().map((c) => c.valor);
    expect(sem).toContain('Limpar o forno');
    expect(com).toContain('Limpar o forno (Cozinha)');
    expect(com).toContain('Repintar as paredes (Geral (sem cômodo) / Sala de Estar)');
    expect(com).toContain('Outra mensal'); // sem cômodo: não ganha parênteses
  });

  it('conta as tarefas que ficam fora do formato (frequência sem bloco)', () => {
    expect(planilhaPeriodica(dados(), { ano: 2026, mes: 11, comComodo: false }).foraDoFormato).toBe(1);
  });
});

describe('planilhaDiaria', () => {
  it('traz o mês e o ano no topo, as iniciais dos dias e os blocos Daily, Weekly e Every 15 Days', () => {
    const grade = planilhaDiaria(dados(), { ano: 2026, mes: 11, comComodo: false });
    expect(grade[1][0].valor).toBe('novembro de 2026');
    // 01/11/2026 é domingo
    expect(grade[2].slice(1, 4).map((c) => c.valor)).toEqual(['D', 'S', 'T']);
    expect(grade.filter((l) => l[0]?.estilo === 'bloco').map((l) => l[0].valor)).toEqual(['Daily', 'Weekly', 'Every 15 Days']);
  });

  it('tem uma coluna por dia do mês (30 em novembro, 29 em fevereiro de ano bissexto)', () => {
    const nov = planilhaDiaria(dados(), { ano: 2026, mes: 11, comComodo: false });
    expect(nov.find((l) => l[0]?.valor === 'Daily')).toHaveLength(31);
    const fev = planilhaDiaria(dados(), { ano: 2028, mes: 2, comComodo: false });
    expect(fev.find((l) => l[0]?.valor === 'Daily')).toHaveLength(30);
  });

  it('a linha da tarefa diária pinta os dias a partir da próxima execução', () => {
    // feita hoje (22/11) mas sem registro no histórico: o que vem a seguir é 23/11
    const grade = planilhaDiaria(dados(), { ano: 2026, mes: 11, comComodo: false });
    const linha = grade.find((l) => l[0]?.valor === 'Aspirar a casa')!;
    expect(linha[23]).toEqual({ valor: 23, estilo: 'due' });
    expect(linha[30]).toEqual({ valor: 30, estilo: 'due' });
    expect(linha[22]).toEqual({ valor: null, estilo: 'vazia' });
  });

  it('sem tarefa diária nem semanal a aba só tem o cabeçalho', () => {
    const grade = planilhaDiaria({ ...dados(), tarefas: [tarefa('x', 'Mensal', 30, null)] }, { ano: 2026, mes: 11, comComodo: false });
    expect(grade.filter((l) => l[0]?.estilo === 'bloco')).toHaveLength(0);
  });
});

describe('planilhaDados e nome do arquivo', () => {
  it('uma linha por tarefa, com as colunas de sempre', () => {
    const grade = planilhaDados(dados());
    expect(grade[0].map((c) => c.valor)).toEqual(['Nome', 'Cômodos', 'Período', 'Frequência (dias)', 'Dias da semana', 'Instruções', 'Última execução', 'Próxima execução', 'Ativa']);
    expect(grade).toHaveLength(8);
    const box = grade.find((l) => l[0].valor === 'Box do banheiro')!;
    expect(box.map((c) => c.valor)).toEqual(['Box do banheiro', 'Banheiro', 'Semanal', 7, 'Seg', '', '20/11/2026', '27/11/2026', 'Sim']);
  });

  it('nome do arquivo leva o ano', () => {
    expect(nomeDoArquivoDeTarefas(2026)).toBe('tarefas-manutencao-2026.xlsx');
  });
});
