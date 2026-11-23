import { somarDias } from './datas';
import { entradaAtrasada } from './historicoTarefa';
import { proximaExecucao } from './manutencao';
import { resumoDosDias } from './diasSemana';
import { rotuloPeriodo } from './filtrosManutencao';
import type { HistoricoTarefa, TarefaManutencao } from '../types';

/**
 * Monta, sem depender de biblioteca de planilha, o conteúdo da exportação das
 * tarefas no formato da aba Esqueleto: um bloco por frequência, uma linha por
 * tarefa e uma coluna por mês (ou por dia, nas diárias e semanais).
 * Verde (DUE): feita no prazo ou ainda por fazer no mês em que vence, com o dia.
 * Vermelho (OVERDUE): feita fora da data prevista, só no mês em que foi feita.
 */

export type EstiloCelula =
  | 'titulo'
  | 'legendaDue'
  | 'legendaOver'
  | 'rotuloMes'
  | 'diaDaSemana'
  | 'bloco'
  | 'blocoColuna'
  | 'nome'
  | 'due'
  | 'over'
  | 'vazia'
  | 'dadosCabecalho'
  | 'dado';

export interface Celula {
  /** Date só nos cabeçalhos de mês (viram data de verdade na planilha). */
  valor: string | number | Date | null;
  estilo: EstiloCelula;
}

export type Grade = Celula[][];

export interface DadosExportacao {
  tarefas: TarefaManutencao[];
  historico: HistoricoTarefa[];
  comodosPorTarefa: Map<string, { nome: string }[]>;
  /** Tarefa -> texto do responsável ("Mariana", "Juntos (Eduardo e Mariana)"...); ausente = sem responsável. */
  responsaveis?: Map<string, string>;
  /** Tarefa -> quem fez na última execução. */
  feitaPorUltima?: Map<string, string>;
  /** Hoje, "AAAA-MM-DD". */
  hoje: string;
}

export interface OpcoesExportacao {
  ano: number;
  /** 1 a 12: o mês das diárias e semanais. */
  mes: number;
  /** Escreve o cômodo no nome da linha. */
  comComodo: boolean;
}

export const MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
const INICIAIS_DIA = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S'];

export type BlocoPeriodico = 'Monthly' | 'Bi-Monthly' | 'Quarterly or Every 4-Months' | 'Bi Annual' | 'Annual' | '2 Years';
export const BLOCOS_PERIODICOS: BlocoPeriodico[] = ['Monthly', 'Bi-Monthly', 'Quarterly or Every 4-Months', 'Bi Annual', 'Annual', '2 Years'];

/** Em que bloco a frequência cai; null = não cabe em nenhum (fica fora da exportação). */
export type BlocoDiario = 'Daily' | 'Weekly' | 'Every 15 Days';
export const BLOCOS_DIARIOS: BlocoDiario[] = ['Daily', 'Weekly', 'Every 15 Days'];

export function blocoDaFrequencia(dias: number): BlocoPeriodico | BlocoDiario | null {
  switch (dias) {
    case 1:
      return 'Daily';
    case 7:
      return 'Weekly';
    case 15:
      return 'Every 15 Days';
    case 30:
      return 'Monthly';
    case 60:
      return 'Bi-Monthly';
    case 90:
    case 120:
      return 'Quarterly or Every 4-Months';
    case 180:
      return 'Bi Annual';
    case 365:
      return 'Annual';
    case 730:
      return '2 Years';
    default:
      return null;
  }
}

function partes(iso: string): { ano: number; mes: number; dia: number } {
  const [ano, mes, dia] = iso.split('-').map(Number);
  return { ano, mes, dia };
}

function diasDoMes(ano: number, mes: number): number {
  return new Date(ano, mes, 0).getDate();
}

function dataIso(ano: number, mes: number, dia: number): string {
  return `${ano}-${String(mes).padStart(2, '0')}-${String(dia).padStart(2, '0')}`;
}

export interface Marca {
  tipo: 'due' | 'over';
  dia: number;
}

/** A execução mais recente de cada mês (ou dia) do período. */
function execucoesNoPeriodo(entradas: HistoricoTarefa[], dentro: (iso: string) => boolean, chave: (iso: string) => number): Map<number, Marca> {
  const marcas = new Map<number, HistoricoTarefa>();
  for (const e of entradas) {
    if (!dentro(e.data_execucao)) continue;
    const k = chave(e.data_execucao);
    const atual = marcas.get(k);
    if (!atual || e.data_execucao > atual.data_execucao || (e.data_execucao === atual.data_execucao && e.criado_em > atual.criado_em)) marcas.set(k, e);
  }
  return new Map([...marcas].map(([k, e]) => [k, { tipo: entradaAtrasada(e) ? 'over' : 'due', dia: partes(e.data_execucao).dia }]));
}

/**
 * Marcas de uma tarefa por mês do ano: o mês em que foi feita (verde, ou
 * vermelho se fora do prazo) e os meses em que ainda vence (verde, com o dia
 * previsto). Meses passados sem execução ficam vazios.
 */
export function marcasPorMes(tarefa: TarefaManutencao, entradas: HistoricoTarefa[], ano: number): Map<number, Marca> {
  const marcas = execucoesNoPeriodo(entradas, (iso) => partes(iso).ano === ano, (iso) => partes(iso).mes);
  const fim = dataIso(ano, 12, 31);
  let data = proximaExecucao(tarefa);
  // Segurança: nunca mais de 400 passos (frequência mínima de 1 dia em um ano).
  for (let i = 0; i < 400 && data <= fim; i++) {
    const p = partes(data);
    if (p.ano === ano && !marcas.has(p.mes)) marcas.set(p.mes, { tipo: 'due', dia: p.dia });
    data = somarDias(data, tarefa.frequencia_dias);
  }
  return marcas;
}

/**
 * Marcas de uma tarefa diária, semanal ou de a cada 15 dias por dia do mês. Semanal com dias da
 * semana marcados usa esses dias para o que ainda vem por aí.
 */
export function marcasPorDia(tarefa: TarefaManutencao, entradas: HistoricoTarefa[], ano: number, mes: number, hoje: string): Map<number, Marca> {
  const marcas = execucoesNoPeriodo(entradas, (iso) => partes(iso).ano === ano && partes(iso).mes === mes, (iso) => partes(iso).dia);
  const total = diasDoMes(ano, mes);
  const inicio = proximaExecucao(tarefa);
  const planejadas = new Set<string>();
  if (tarefa.frequencia_dias === 7 && tarefa.dias_semana.length > 0) {
    // A data do ciclo, se já passou (atrasada), e os dias da semana escolhidos de hoje em diante.
    if (inicio < hoje) planejadas.add(inicio);
    for (let dia = 1; dia <= total; dia++) {
      const iso = dataIso(ano, mes, dia);
      const diaDaSemana = (new Date(ano, mes - 1, dia).getDay() + 6) % 7;
      if (iso >= hoje && tarefa.dias_semana.includes(diaDaSemana)) planejadas.add(iso);
    }
  } else {
    let data = inicio;
    const fim = dataIso(ano, mes, total);
    for (let i = 0; i < 400 && data <= fim; i++) {
      planejadas.add(data);
      data = somarDias(data, tarefa.frequencia_dias);
    }
  }
  for (const iso of planejadas) {
    const p = partes(iso);
    if (p.ano === ano && p.mes === mes && !marcas.has(p.dia)) marcas.set(p.dia, { tipo: 'due', dia: p.dia });
  }
  return marcas;
}

function nomeDaLinha(tarefa: TarefaManutencao, dados: DadosExportacao, comComodo: boolean): string {
  const comodos = (dados.comodosPorTarefa.get(tarefa.id) ?? []).map((c) => c.nome);
  return comComodo && comodos.length > 0 ? `${tarefa.nome} (${comodos.join(' / ')})` : tarefa.nome;
}

/** Cômodo (o primeiro, em ordem alfabética) e depois nome; sem cômodo por último. */
function ordenar(tarefas: TarefaManutencao[], dados: DadosExportacao): TarefaManutencao[] {
  const comodo = (t: TarefaManutencao) => (dados.comodosPorTarefa.get(t.id) ?? []).map((c) => c.nome).sort((a, b) => a.localeCompare(b, 'pt-BR'))[0] ?? '￿';
  return [...tarefas].sort((a, b) => comodo(a).localeCompare(comodo(b), 'pt-BR') || a.nome.localeCompare(b.nome, 'pt-BR'));
}

function entradasPorTarefa(historico: HistoricoTarefa[]): Map<string, HistoricoTarefa[]> {
  const mapa = new Map<string, HistoricoTarefa[]>();
  for (const e of historico) mapa.set(e.tarefa_id, [...(mapa.get(e.tarefa_id) ?? []), e]);
  return mapa;
}

function linhaLegenda(): Celula[] {
  return [
    { valor: 'Household Tasks', estilo: 'titulo' },
    { valor: 'DUE', estilo: 'legendaDue' },
    { valor: 'OVERDUE', estilo: 'legendaOver' },
  ];
}

function celulaDaMarca(marca: Marca | undefined): Celula {
  return marca ? { valor: marca.dia, estilo: marca.tipo } : { valor: null, estilo: 'vazia' };
}

/** Aba no formato do Esqueleto: Monthly, Bi-Monthly, Quarterly or Every 4-Months, Bi Annual, Annual e 2 Years, com os 12 meses do ano. */
export function planilhaPeriodica(dados: DadosExportacao, opcoes: OpcoesExportacao): { grade: Grade; foraDoFormato: number } {
  const entradas = entradasPorTarefa(dados.historico);
  const grade: Grade = [linhaLegenda()];
  let foraDoFormato = 0;
  for (const t of dados.tarefas) {
    const bloco = blocoDaFrequencia(t.frequencia_dias);
    if (bloco === null) foraDoFormato++;
  }
  for (const bloco of BLOCOS_PERIODICOS) {
    const doBloco = ordenar(dados.tarefas.filter((t) => blocoDaFrequencia(t.frequencia_dias) === bloco), dados);
    if (doBloco.length === 0) continue;
    grade.push([
      { valor: bloco, estilo: 'bloco' },
      ...MESES.map((_, i): Celula => ({ valor: new Date(Date.UTC(opcoes.ano, i, 1)), estilo: 'blocoColuna' })),
    ]);
    for (const t of doBloco) {
      const marcas = marcasPorMes(t, entradas.get(t.id) ?? [], opcoes.ano);
      grade.push([{ valor: nomeDaLinha(t, dados, opcoes.comComodo), estilo: 'nome' }, ...MESES.map((_, i) => celulaDaMarca(marcas.get(i + 1)))]);
    }
    grade.push([]);
  }
  while (grade.length > 1 && grade[grade.length - 1].length === 0) grade.pop();
  return { grade, foraDoFormato };
}

/** Aba das diárias, semanais e de a cada 15 dias: o mês e o ano no topo e uma coluna por dia do mês. */
export function planilhaDiaria(dados: DadosExportacao, opcoes: OpcoesExportacao): Grade {
  const entradas = entradasPorTarefa(dados.historico);
  const total = diasDoMes(opcoes.ano, opcoes.mes);
  const dias = Array.from({ length: total }, (_, i) => i + 1);
  const grade: Grade = [
    linhaLegenda(),
    [{ valor: `${MESES[opcoes.mes - 1]} de ${opcoes.ano}`, estilo: 'rotuloMes' }],
    [{ valor: null, estilo: 'vazia' }, ...dias.map((d): Celula => ({ valor: INICIAIS_DIA[new Date(opcoes.ano, opcoes.mes - 1, d).getDay()], estilo: 'diaDaSemana' }))],
  ];
  for (const bloco of BLOCOS_DIARIOS) {
    const doBloco = ordenar(dados.tarefas.filter((t) => blocoDaFrequencia(t.frequencia_dias) === bloco), dados);
    if (doBloco.length === 0) continue;
    grade.push([{ valor: bloco, estilo: 'bloco' }, ...dias.map((d): Celula => ({ valor: d, estilo: 'blocoColuna' }))]);
    for (const t of doBloco) {
      const marcas = marcasPorDia(t, entradas.get(t.id) ?? [], opcoes.ano, opcoes.mes, dados.hoje);
      grade.push([{ valor: nomeDaLinha(t, dados, opcoes.comComodo), estilo: 'nome' }, ...dias.map((d) => celulaDaMarca(marcas.get(d)))]);
    }
    grade.push([]);
  }
  while (grade.length > 1 && grade[grade.length - 1].length === 0) grade.pop();
  return grade;
}

function formatar(iso: string | null): string {
  if (!iso) return '';
  const { ano, mes, dia } = partes(iso);
  return `${String(dia).padStart(2, '0')}/${String(mes).padStart(2, '0')}/${ano}`;
}

/** Aba com uma linha por tarefa e todas as colunas, para filtrar e reimportar. */
export function planilhaDados(dados: DadosExportacao): Grade {
  const cabecalho = ['Nome', 'Cômodos', 'Responsável', 'Período', 'Frequência (dias)', 'Dias da semana', 'Instruções', 'Última execução', 'Feita por (última vez)', 'Próxima execução', 'Ativa'];
  const grade: Grade = [cabecalho.map((valor): Celula => ({ valor, estilo: 'dadosCabecalho' }))];
  for (const t of ordenar(dados.tarefas, dados)) {
    const linha: (string | number)[] = [
      t.nome,
      (dados.comodosPorTarefa.get(t.id) ?? []).map((c) => c.nome).join(' | '),
      dados.responsaveis?.get(t.id) ?? '',
      rotuloPeriodo(t.frequencia_dias),
      t.frequencia_dias,
      resumoDosDias(t.dias_semana),
      t.instrucoes ?? '',
      formatar(t.ultima_execucao),
      dados.feitaPorUltima?.get(t.id) ?? '',
      formatar(proximaExecucao(t)),
      t.ativo ? 'Sim' : 'Não',
    ];
    grade.push(linha.map((valor): Celula => ({ valor, estilo: 'dado' })));
  }
  return grade;
}

export function nomeDoArquivoDeTarefas(ano: number): string {
  return `tarefas-manutencao-${ano}.xlsx`;
}
