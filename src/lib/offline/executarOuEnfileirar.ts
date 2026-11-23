import type { QueryClient } from '@tanstack/react-query';
import { aplicarAtualizarExecucao, aplicarAtualizarLinha, aplicarDefinirAdiamento, aplicarDefinirClassificacoes, aplicarDefinirPessoasExecucao, aplicarEdicaoStorage, aplicarExcluirExecucao, aplicarExcluirLinhas, aplicarInserirExecucao, aplicarInserirLinha, aplicarSalvarCaixa, type EstadoManutencao, type EstadoStorage } from './aplicarLocal';
import { executarOperacao } from './executores';
import { contarFila, enfileirar, pedirEnvioDaFila, type TipoOperacao } from './fila';
import { guardarArquivo } from './arquivos';
import type { AtualizarExecucaoDados, AtualizarLinhaDados, ChaveDeConsulta, DefinirAdiamentoDados, DefinirClassificacoesDados, DefinirFotoDados, DefinirPessoasExecucaoDados, ExcluirAnexoDados, ExcluirLinhasDados, IncluirAnexoDados, InserirLinhaDados, LinhaGenerica, EdicaoStorageDados, ExcluirExecucaoDados, InserirExecucaoDados, SalvarCaixaDados } from './operacoes';
import type { AnexoStorage, CaixaStorage, HistoricoPessoa, HistoricoTarefa, ItemStorage, ObsStorage, TagItem, TarefaManutencao } from '../../types';

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

function atualizarLista(qc: QueryClient, chave: ChaveDeConsulta, aplicar: (lista: LinhaGenerica[]) => LinhaGenerica[]) {
  qc.setQueryData(chave, (antiga: unknown) => (Array.isArray(antiga) ? aplicar(antiga as LinhaGenerica[]) : antiga));
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
    case 'tabela.inserir': {
      const d = dados as InserirLinhaDados;
      return atualizarLista(qc, d.consulta, (lista) => aplicarInserirLinha(lista, d));
    }
    case 'tabela.atualizar': {
      const d = dados as AtualizarLinhaDados;
      return d.consultas.forEach((c) => atualizarLista(qc, c, (lista) => aplicarAtualizarLinha(lista, d)));
    }
    case 'tabela.excluir': {
      const d = dados as ExcluirLinhasDados;
      return d.consultas.forEach((c) => atualizarLista(qc, c, (lista) => aplicarExcluirLinhas(lista, d)));
    }
    case 'anexo.incluir': {
      const d = dados as IncluirAnexoDados;
      return atualizarLista(qc, d.consulta, (lista) => aplicarInserirLinha(lista, { linha: d.linha, ordenarPor: { campo: 'criado_em' } }));
    }
    case 'anexo.excluir': {
      const d = dados as ExcluirAnexoDados;
      return atualizarLista(qc, d.consulta, (lista) => aplicarExcluirLinhas(lista, { ids: [d.id] }));
    }
    case 'tarefa.definirClassificacoes': {
      const d = dados as DefinirClassificacoesDados;
      qc.setQueryData(['tarefa_classificacoes'], (antigo: unknown) => (antigo instanceof Map ? aplicarDefinirClassificacoes(antigo as Map<string, TagItem[]>, d) : antigo));
      return;
    }
    case 'gato.definirFoto': {
      const d = dados as DefinirFotoDados;
      return atualizarLista(qc, ['gatos'], (lista) => aplicarAtualizarLinha(lista, { id: d.gatoId, mudancas: { foto_url: d.caminho } }));
    }
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
  await guardarArquivoLocal(tipo, dados);
  await enfileirar(tipo, dados);
  if (navigator.onLine) pedirEnvioDaFila();
  return 'enfileirada';
}

/** Arquivo que ainda não subiu: fica no aparelho (para aparecer e abrir sem internet) até a fila ser enviada. */
async function guardarArquivoLocal(tipo: TipoOperacao, dados: unknown): Promise<void> {
  try {
    if (tipo === 'anexo.incluir') {
      const d = dados as IncluirAnexoDados;
      if (d.arquivoLocal) await guardarArquivo({ bucket: d.bucket, caminho: String(d.linha.arquivo_url), versao: d.linha.id }, d.arquivoLocal);
    } else if (tipo === 'gato.definirFoto') {
      const d = dados as DefinirFotoDados;
      if (d.arquivoLocal && d.caminho) await guardarArquivo({ bucket: 'confidencial', caminho: d.caminho, versao: d.caminho }, d.arquivoLocal);
    }
  } catch {
    // Sem cópia local o arquivo só aparece depois do envio; a alteração em si segue na fila.
  }
}
