import { supabase } from '../supabaseClient';
import { enviarArquivo, removerArquivos } from '../storage';
import { resumoDoHistorico } from '../historicoTarefa';
import type { HistoricoTarefa } from '../../types';
import type { OperacaoPendente } from './fila';
import type {
  AtualizarExecucaoDados,
  DefinirAdiamentoDados,
  DefinirPessoasExecucaoDados,
  EdicaoStorageDados,
  ExcluirExecucaoDados,
  InserirExecucaoDados,
  SalvarCaixaDados,
} from './operacoes';

/**
 * As gravações no servidor de cada tipo de alteração. Servem tanto ao caminho
 * com internet (a alteração roda na hora) quanto ao envio da fila. Por isso
 * precisam aguentar rodar de novo se o envio caiu no meio: usam upsert e
 * exclusões que não reclamam de linha que já não existe.
 */

export const BUCKET_STORAGE = 'confidencial';

/** Apaga do bucket os arquivos de todos os anexos desses itens (as linhas saem junto com o item, por cascade). */
async function removerArquivosDosItens(itemIds: string[]): Promise<void> {
  if (itemIds.length === 0) return;
  const { data, error } = await supabase.from('storage_anexos').select('arquivo_url').in('item_id', itemIds);
  if (error) throw error;
  await removerArquivos(BUCKET_STORAGE, (data as { arquivo_url: string }[]).map((a) => a.arquivo_url));
}

/**
 * Salva a caixa inteira de uma vez: a caixa (com o id já gerado no aparelho,
 * pra bater com os arquivos enviados durante a criação), os itens, as
 * observações e os anexos. Foto tirada sem internet sobe antes de entrar no banco.
 */
export async function executarSalvarCaixa({ id, numero, nome, novo, ordemNova, itens, itensRemovidos }: SalvarCaixaDados): Promise<void> {
  if (novo) {
    const { error } = await supabase.from('storage').upsert({ id, ...(numero !== undefined ? { numero } : {}), nome, ordem: ordemNova });
    if (error) throw error;
  } else {
    const { error } = await supabase.from('storage').update({ nome }).eq('id', id);
    if (error) throw error;
  }

  if (itensRemovidos.length > 0) {
    await removerArquivosDosItens(itensRemovidos);
    const { error } = await supabase.from('storage_itens').delete().in('id', itensRemovidos);
    if (error) throw error;
  }

  if (itens.length === 0) return;
  const linhasItens = itens.map((item, indice) => ({
    id: item.id,
    storage_id: id,
    nome: item.nome,
    quantidade: item.quantidade,
    tag_id: item.tag_id,
    ordem: indice + 1,
  }));
  const { error: erroItens } = await supabase.from('storage_itens').upsert(linhasItens);
  if (erroItens) throw erroItens;

  // Observações: substitui o conjunto de cada item.
  const { error: erroLimparObs } = await supabase.from('storage_obs').delete().in('item_id', itens.map((i) => i.id));
  if (erroLimparObs) throw erroLimparObs;
  const linhasObs = itens.flatMap((item) => item.obs.map((texto, indice) => ({ item_id: item.id, texto, ordem: indice + 1 })));
  if (linhasObs.length > 0) {
    const { error } = await supabase.from('storage_obs').insert(linhasObs);
    if (error) throw error;
  }

  // Anexos: os removidos saem do banco e do bucket, os novos sobem e entram.
  const removidos = itens.flatMap((item) => item.anexosRemovidos);
  if (removidos.length > 0) {
    const { error } = await supabase.from('storage_anexos').delete().in('id', removidos.map((a) => a.id));
    if (error) throw error;
    await removerArquivos(BUCKET_STORAGE, removidos.map((a) => a.arquivo_url));
  }
  const novosAnexos = itens.flatMap((item) => item.anexosNovos.map((anexo) => ({ item, anexo })));
  for (const { anexo } of novosAnexos) {
    if (!anexo.arquivoLocal) continue;
    const arquivo = anexo.arquivoLocal instanceof File ? anexo.arquivoLocal : new File([anexo.arquivoLocal], anexo.nome_arquivo, { type: anexo.arquivoLocal.type });
    await enviarArquivo(BUCKET_STORAGE, anexo.arquivo_url, arquivo);
  }
  if (novosAnexos.length > 0) {
    const { error } = await supabase
      .from('storage_anexos')
      .upsert(novosAnexos.map(({ item, anexo }) => ({ id: anexo.id, item_id: item.id, nome: anexo.nome, arquivo_url: anexo.arquivo_url, nome_arquivo: anexo.nome_arquivo })));
    if (error) throw error;
  }
}

/** Aplica de uma vez o que ficou pendente no modo de edição: ordem, mudança de caixa, nomes e exclusões. */
export async function executarEdicaoStorage({ caixas, itens, renomeacoes, caixasExcluidas, itensExcluidos }: EdicaoStorageDados): Promise<void> {
  const excluir = new Set(caixasExcluidas);
  const exclusaoItens = new Set(itensExcluidos);

  // Primeiro o que é movido, pra um item nunca ser apagado junto com a caixa de onde saiu.
  for (const { id, storage_id, ordem } of itens) {
    if (exclusaoItens.has(id)) continue;
    const { error } = await supabase.from('storage_itens').update({ storage_id, ordem }).eq('id', id);
    if (error) throw error;
  }
  for (const { id, nome } of renomeacoes) {
    if (excluir.has(id)) continue;
    const { error } = await supabase.from('storage').update({ nome }).eq('id', id);
    if (error) throw error;
  }
  for (const { id, ordem } of caixas) {
    if (excluir.has(id)) continue;
    const { error } = await supabase.from('storage').update({ ordem }).eq('id', id);
    if (error) throw error;
  }

  if (itensExcluidos.length > 0) {
    await removerArquivosDosItens(itensExcluidos);
    const { error } = await supabase.from('storage_itens').delete().in('id', itensExcluidos);
    if (error) throw error;
  }
  if (caixasExcluidas.length > 0) {
    const { data, error: erroItens } = await supabase.from('storage_itens').select('id').in('storage_id', caixasExcluidas);
    if (erroItens) throw erroItens;
    await removerArquivosDosItens((data as { id: string }[]).map((i) => i.id));
    const { error } = await supabase.from('storage').delete().in('id', caixasExcluidas);
    if (error) throw error;
  }
}

export async function entradasDaTarefa(tarefaId: string): Promise<HistoricoTarefa[]> {
  const { data, error } = await supabase.from('tarefas_manutencao_historico').select('*').eq('tarefa_id', tarefaId);
  if (error) throw error;
  return data as HistoricoTarefa[];
}

/** Recalcula, a partir do histórico, a última execução e a data-base da próxima, e grava na tarefa. */
async function recalcularTarefa(tarefaId: string, encerrarAdiamentoSeFeitaEm?: string): Promise<void> {
  const resumo = resumoDoHistorico(await entradasDaTarefa(tarefaId));
  // Fazer a tarefa (como execução mais recente) encerra o adiamento.
  const encerra = encerrarAdiamentoSeFeitaEm !== undefined && resumo.ultima_execucao === encerrarAdiamentoSeFeitaEm;
  const { error } = await supabase.from('tarefas_manutencao').update(encerra ? { ...resumo, adiada_ate: null } : resumo).eq('id', tarefaId);
  if (error) throw error;
}

/** Adia a tarefa para uma data (ou cancela o adiamento com null). */
export async function executarDefinirAdiamento({ tarefaId, adiadaAte }: DefinirAdiamentoDados): Promise<void> {
  const { error } = await supabase.from('tarefas_manutencao').update({ adiada_ate: adiadaAte }).eq('id', tarefaId);
  if (error) throw error;
}

/** Troca quem fez uma execução (o conjunto inteiro, como nas observações). */
export async function executarDefinirPessoasExecucao({ historicoId, pessoaIds }: DefinirPessoasExecucaoDados): Promise<void> {
  const { error: erroLimpar } = await supabase.from('tarefas_historico_pessoas').delete().eq('historico_id', historicoId);
  if (erroLimpar) throw erroLimpar;
  if (pessoaIds.length === 0) return;
  const { error } = await supabase.from('tarefas_historico_pessoas').insert(pessoaIds.map((pessoa_id) => ({ historico_id: historicoId, pessoa_id })));
  if (error) throw error;
}

export async function executarInserirExecucao({ id, tarefaId, dataExecucao, dataPrevista, base, pessoaIds }: InserirExecucaoDados): Promise<void> {
  const { error } = await supabase
    .from('tarefas_manutencao_historico')
    .upsert({ id, tarefa_id: tarefaId, data_execucao: dataExecucao, data_prevista: dataPrevista, base_proxima: base });
  if (error) throw error;
  await executarDefinirPessoasExecucao({ historicoId: id, pessoaIds });
  await recalcularTarefa(tarefaId, dataExecucao);
}

export async function executarAtualizarExecucao({ id, tarefaId, dataExecucao, base }: AtualizarExecucaoDados): Promise<void> {
  const mudancas: Record<string, string> = {};
  if (dataExecucao) mudancas.data_execucao = dataExecucao;
  if (base) mudancas.base_proxima = base;
  const { error } = await supabase.from('tarefas_manutencao_historico').update(mudancas).eq('id', id);
  if (error) throw error;
  await recalcularTarefa(tarefaId);
}

export async function executarExcluirExecucao({ id, tarefaId }: ExcluirExecucaoDados): Promise<void> {
  const { error } = await supabase.from('tarefas_manutencao_historico').delete().eq('id', id);
  if (error) throw error;
  await recalcularTarefa(tarefaId);
}

/** Roda uma operação da fila no servidor. */
export async function executarOperacao({ tipo, dados }: Pick<OperacaoPendente, 'tipo' | 'dados'>): Promise<void> {
  switch (tipo) {
    case 'storage.salvarCaixa':
      return executarSalvarCaixa(dados as SalvarCaixaDados);
    case 'storage.aplicarEdicao':
      return executarEdicaoStorage(dados as EdicaoStorageDados);
    case 'manutencao.inserirExecucao':
      return executarInserirExecucao(dados as InserirExecucaoDados);
    case 'manutencao.atualizarExecucao':
      return executarAtualizarExecucao(dados as AtualizarExecucaoDados);
    case 'manutencao.definirPessoasExecucao':
      return executarDefinirPessoasExecucao(dados as DefinirPessoasExecucaoDados);
    case 'manutencao.excluirExecucao':
      return executarExcluirExecucao(dados as ExcluirExecucaoDados);
    case 'manutencao.definirAdiamento':
      return executarDefinirAdiamento(dados as DefinirAdiamentoDados);
  }
}
