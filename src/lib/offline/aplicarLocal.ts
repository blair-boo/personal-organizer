import { resumoDoHistorico } from '../historicoTarefa';
import type { AnexoStorage, CaixaStorage, HistoricoTarefa, ItemStorage, ObsStorage, TarefaManutencao } from '../../types';
import type {
  AtualizarExecucaoDados,
  EdicaoStorageDados,
  ExcluirExecucaoDados,
  InserirExecucaoDados,
  SalvarCaixaDados,
} from './operacoes';

/**
 * Aplica no que está na tela (e guardado no aparelho) uma alteração que ainda
 * espera internet, pra ela aparecer na hora. Funções puras: devolvem o estado
 * novo. Quando a fila é enviada, as consultas são buscadas de novo e o servidor
 * passa a ser a fonte da verdade.
 */

export interface EstadoStorage {
  caixas: CaixaStorage[];
  itens: ItemStorage[];
  obs: ObsStorage[];
  anexos: AnexoStorage[];
}

export function aplicarSalvarCaixa(estado: EstadoStorage, dados: SalvarCaixaDados): EstadoStorage {
  let caixas = estado.caixas;
  if (dados.novo) {
    caixas = [...caixas, { id: dados.id, numero: dados.numero ?? 0, nome: dados.nome, ordem: dados.ordemNova }];
  } else {
    caixas = caixas.map((c) => (c.id === dados.id ? { ...c, nome: dados.nome } : c));
  }

  const removidos = new Set(dados.itensRemovidos);
  const mantidos = new Set(dados.itens.map((i) => i.id));
  let itens = estado.itens.filter((i) => !removidos.has(i.id));
  let obs = estado.obs.filter((o) => !removidos.has(o.item_id) && !mantidos.has(o.item_id));
  const anexosRemovidos = new Set(dados.itens.flatMap((i) => i.anexosRemovidos.map((a) => a.id)));
  let anexos = estado.anexos.filter((a) => !removidos.has(a.item_id) && !anexosRemovidos.has(a.id));

  itens = [
    ...itens.filter((i) => !mantidos.has(i.id)),
    ...dados.itens.map((item, indice): ItemStorage => ({
      id: item.id,
      storage_id: dados.id,
      nome: item.nome,
      quantidade: item.quantidade,
      tag_id: item.tag_id,
      ordem: indice + 1,
    })),
  ];
  obs = [
    ...obs,
    ...dados.itens.flatMap((item) => item.obs.map((texto, i): ObsStorage => ({ id: `local-${item.id}-${i}`, item_id: item.id, texto, ordem: i + 1 }))),
  ];
  anexos = [
    ...anexos,
    ...dados.itens.flatMap((item) =>
      item.anexosNovos.map((a): AnexoStorage => ({ id: a.id, item_id: item.id, nome: a.nome, arquivo_url: a.arquivo_url, nome_arquivo: a.nome_arquivo }))
    ),
  ];
  return { caixas, itens, obs, anexos };
}

export function aplicarEdicaoStorage(estado: EstadoStorage, dados: EdicaoStorageDados): EstadoStorage {
  const caixasExcluidas = new Set(dados.caixasExcluidas);
  const itensExcluidos = new Set(dados.itensExcluidos);
  const nomes = new Map(dados.renomeacoes.map((r) => [r.id, r.nome]));
  const ordensCaixa = new Map(dados.caixas.map((c) => [c.id, c.ordem]));
  const movidos = new Map(dados.itens.map((i) => [i.id, i]));

  const caixas = estado.caixas
    .filter((c) => !caixasExcluidas.has(c.id))
    .map((c) => ({ ...c, nome: nomes.get(c.id) ?? c.nome, ordem: ordensCaixa.get(c.id) ?? c.ordem }));
  // Um item movido para fora de uma caixa excluída se salva; os que ficaram nela somem junto.
  const itens = estado.itens
    .map((i) => {
      const movido = movidos.get(i.id);
      return movido ? { ...i, storage_id: movido.storage_id, ordem: movido.ordem } : i;
    })
    .filter((i) => !itensExcluidos.has(i.id) && !caixasExcluidas.has(i.storage_id));
  const vivos = new Set(itens.map((i) => i.id));
  return {
    caixas,
    itens,
    obs: estado.obs.filter((o) => vivos.has(o.item_id)),
    anexos: estado.anexos.filter((a) => vivos.has(a.item_id)),
  };
}

export interface EstadoManutencao {
  tarefas: TarefaManutencao[];
  historico: HistoricoTarefa[];
}

/** Recalcula a última execução e a data-base da tarefa a partir do histórico, como o servidor faz ao enviar. */
function recalcular(estado: EstadoManutencao, tarefaId: string): EstadoManutencao {
  const resumo = resumoDoHistorico(estado.historico.filter((h) => h.tarefa_id === tarefaId));
  return { ...estado, tarefas: estado.tarefas.map((t) => (t.id === tarefaId ? { ...t, ...resumo } : t)) };
}

export function aplicarInserirExecucao(estado: EstadoManutencao, dados: InserirExecucaoDados, agora = new Date().toISOString()): EstadoManutencao {
  const entrada: HistoricoTarefa = {
    id: dados.id,
    tarefa_id: dados.tarefaId,
    data_execucao: dados.dataExecucao,
    data_prevista: dados.dataPrevista,
    base_proxima: dados.base,
    observacao: null,
    criado_em: agora,
  };
  const historico = [entrada, ...estado.historico].sort((a, b) => b.data_execucao.localeCompare(a.data_execucao) || b.criado_em.localeCompare(a.criado_em));
  return recalcular({ ...estado, historico }, dados.tarefaId);
}

export function aplicarAtualizarExecucao(estado: EstadoManutencao, dados: AtualizarExecucaoDados): EstadoManutencao {
  const historico = estado.historico.map((h) =>
    h.id === dados.id ? { ...h, data_execucao: dados.dataExecucao ?? h.data_execucao, base_proxima: dados.base ?? h.base_proxima } : h
  );
  return recalcular({ ...estado, historico }, dados.tarefaId);
}

export function aplicarExcluirExecucao(estado: EstadoManutencao, dados: ExcluirExecucaoDados): EstadoManutencao {
  return recalcular({ ...estado, historico: estado.historico.filter((h) => h.id !== dados.id) }, dados.tarefaId);
}
