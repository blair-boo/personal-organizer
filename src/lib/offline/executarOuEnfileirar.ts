import type { QueryClient } from '@tanstack/react-query';
import { aplicarAtualizarExecucao, aplicarDefinirAdiamento, aplicarDefinirPessoasExecucao, aplicarEdicaoStorage, aplicarExcluirExecucao, aplicarInserirExecucao, aplicarSalvarCaixa, type EstadoManutencao, type EstadoStorage } from './aplicarLocal';
import { executarOperacao } from './executores';
import { contarFila, enfileirar, pedirEnvioDaFila, type TipoOperacao } from './fila';
import type { AtualizarExecucaoDados, DefinirAdiamentoDados, DefinirPessoasExecucaoDados, EdicaoStorageDados, ExcluirExecucaoDados, InserirExecucaoDados, SalvarCaixaDados } from './operacoes';
import type { AnexoStorage, CaixaStorage, HistoricoPessoa, HistoricoTarefa, ItemStorage, ObsStorage, TarefaManutencao } from '../../types';

function porOrdem<T extends { ordem: number; nome: string }>(lista: T[]): T[] {
  return [...lista].sort((a, b) => a.ordem - b.ordem || a.nome.localeCompare(b.nome, 'pt-BR'));
}

function atualizarStorage(qc: QueryClient, aplicar: (e: EstadoStorage) => EstadoStorage) {
  const novo = aplicar({
    caixas: qc.getQueryData<CaixaStorage[]>(['storage']) ?? [],
    itens: qc.getQueryData<ItemStorage[]>(['storage_itens']) ?? [],
    obs: qc.getQueryData<ObsStorage[]>(['storage_obs']) ?? [],
    anexos: qc.getQueryData<AnexoStorage[]>(['storage_anexos']) ?? [],
  });
  qc.setQueryData(['storage'], porOrdem(novo.caixas));
  qc.setQueryData(['storage_itens'], porOrdem(novo.itens));
  qc.setQueryData(['storage_obs'], novo.obs);
  qc.setQueryData(['storage_anexos'], novo.anexos);
}

function atualizarManutencao(qc: QueryClient, aplicar: (e: EstadoManutencao) => EstadoManutencao) {
  const novo = aplicar({
    tarefas: qc.getQueryData<TarefaManutencao[]>(['tarefas_manutencao']) ?? [],
    historico: qc.getQueryData<HistoricoTarefa[]>(['tarefas_manutencao_historico']) ?? [],
    historicoPessoas: qc.getQueryData<HistoricoPessoa[]>(['tarefas_historico_pessoas']) ?? [],
  });
  qc.setQueryData(['tarefas_manutencao'], novo.tarefas);
  qc.setQueryData(['tarefas_manutencao_historico'], novo.historico);
  qc.setQueryData(['tarefas_historico_pessoas'], novo.historicoPessoas);
}

/** Mostra na tela, sem esperar o servidor, uma alteração que foi para a fila. */
export function aplicarNoCache(qc: QueryClient, tipo: TipoOperacao, dados: unknown): void {
  switch (tipo) {
    case 'storage.salvarCaixa':
      return atualizarStorage(qc, (e) => aplicarSalvarCaixa(e, dados as SalvarCaixaDados));
    case 'storage.aplicarEdicao':
      return atualizarStorage(qc, (e) => aplicarEdicaoStorage(e, dados as EdicaoStorageDados));
    case 'manutencao.inserirExecucao':
      return atualizarManutencao(qc, (e) => aplicarInserirExecucao(e, dados as InserirExecucaoDados));
    case 'manutencao.atualizarExecucao':
      return atualizarManutencao(qc, (e) => aplicarAtualizarExecucao(e, dados as AtualizarExecucaoDados));
    case 'manutencao.definirPessoasExecucao':
      return atualizarManutencao(qc, (e) => aplicarDefinirPessoasExecucao(e, dados as DefinirPessoasExecucaoDados));
    case 'manutencao.excluirExecucao':
      return atualizarManutencao(qc, (e) => aplicarExcluirExecucao(e, dados as ExcluirExecucaoDados));
    case 'manutencao.definirAdiamento':
      return atualizarManutencao(qc, (e) => aplicarDefinirAdiamento(e, dados as DefinirAdiamentoDados));
  }
}

/**
 * Com internet e a fila vazia, roda a alteração na hora. Sem internet, ou se já
 * há alterações esperando (a ordem tem que ser mantida), mostra na tela e põe na
 * fila; ela segue quando a conexão voltar.
 */
export async function executarOuEnfileirar(qc: QueryClient, tipo: TipoOperacao, dados: unknown): Promise<'enviada' | 'enfileirada'> {
  if (navigator.onLine && (await contarFila()) === 0) {
    await executarOperacao({ tipo, dados });
    return 'enviada';
  }
  aplicarNoCache(qc, tipo, dados);
  await enfileirar(tipo, dados);
  if (navigator.onLine) pedirEnvioDaFila();
  return 'enfileirada';
}
