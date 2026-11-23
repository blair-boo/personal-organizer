import { resumoDoHistorico } from '../historicoTarefa';
import type { AnexoStorage, CaixaStorage, HistoricoPessoa, HistoricoTarefa, ItemStorage, ObsStorage, TagItem, TarefaManutencao } from '../../types';
import type {
  AtualizarExecucaoDados,
  AtualizarLinhaDados,
  DefinirAdiamentoDados,
  DefinirClassificacoesDados,
  DefinirPessoasExecucaoDados,
  EdicaoStorageDados,
  ExcluirExecucaoDados,
  ExcluirLinhasDados,
  InserirExecucaoDados,
  InserirLinhaDados,
  LinhaGenerica,
  SubstituirConjuntoDados,
  CriarCasalDados,
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
  historicoPessoas: HistoricoPessoa[];
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
  const historicoPessoas = [...estado.historicoPessoas.filter((h) => h.historico_id !== dados.id), ...dados.pessoaIds.map((pessoa_id): HistoricoPessoa => ({ historico_id: dados.id, pessoa_id }))];
  const recalculado = recalcular({ ...estado, historico, historicoPessoas }, dados.tarefaId);
  // Fazer a tarefa (como execução mais recente) encerra o adiamento.
  return {
    ...recalculado,
    tarefas: recalculado.tarefas.map((t) => (t.id === dados.tarefaId && t.ultima_execucao === dados.dataExecucao ? { ...t, adiada_ate: null } : t)),
  };
}

export function aplicarDefinirAdiamento(estado: EstadoManutencao, dados: DefinirAdiamentoDados): EstadoManutencao {
  return { ...estado, tarefas: estado.tarefas.map((t) => (t.id === dados.tarefaId ? { ...t, adiada_ate: dados.adiadaAte } : t)) };
}

export function aplicarAtualizarExecucao(estado: EstadoManutencao, dados: AtualizarExecucaoDados): EstadoManutencao {
  const historico = estado.historico.map((h) =>
    h.id === dados.id ? { ...h, data_execucao: dados.dataExecucao ?? h.data_execucao, base_proxima: dados.base ?? h.base_proxima } : h
  );
  return recalcular({ ...estado, historico }, dados.tarefaId);
}

export function aplicarExcluirExecucao(estado: EstadoManutencao, dados: ExcluirExecucaoDados): EstadoManutencao {
  return recalcular(
    { ...estado, historico: estado.historico.filter((h) => h.id !== dados.id), historicoPessoas: estado.historicoPessoas.filter((h) => h.historico_id !== dados.id) },
    dados.tarefaId
  );
}

/** Troca quem fez uma execução. */
export function aplicarDefinirPessoasExecucao(estado: EstadoManutencao, dados: DefinirPessoasExecucaoDados): EstadoManutencao {
  return {
    ...estado,
    historicoPessoas: [
      ...estado.historicoPessoas.filter((h) => h.historico_id !== dados.historicoId),
      ...dados.pessoaIds.map((pessoa_id): HistoricoPessoa => ({ historico_id: dados.historicoId, pessoa_id })),
    ],
  };
}

// --- Linhas genéricas ------------------------------------------------------------------

function ordenar<T extends Record<string, unknown>>(lista: T[], ordenarPor?: { campo: string; decrescente?: boolean }): T[] {
  if (!ordenarPor) return lista;
  const { campo, decrescente } = ordenarPor;
  const comparar = (a: T, b: T): number => {
    const x = a[campo];
    const y = b[campo];
    if (typeof x === 'number' && typeof y === 'number') return x - y;
    return String(x ?? '').localeCompare(String(y ?? ''), 'pt-BR');
  };
  return [...lista].sort((a, b) => (decrescente ? -1 : 1) * comparar(a, b));
}

/** Insere a linha (ou troca, se o id já existe) numa lista de consulta. Sem criado_em na linha, usa o momento atual só para a tela. */
export function aplicarInserirLinha<T extends LinhaGenerica>(lista: T[], dados: Pick<InserirLinhaDados, 'linha' | 'ordenarPor'>, agora = new Date().toISOString()): T[] {
  const linha = { criado_em: agora, ...dados.linha } as unknown as T;
  const sem = lista.filter((l) => l.id !== linha.id);
  return ordenar([...sem, linha], dados.ordenarPor);
}

export function aplicarAtualizarLinha<T extends LinhaGenerica>(lista: T[], dados: Pick<AtualizarLinhaDados, 'id' | 'mudancas' | 'ordenarPor'>): T[] {
  return ordenar(lista.map((l) => (l.id === dados.id ? { ...l, ...dados.mudancas } : l)), dados.ordenarPor);
}

export function aplicarExcluirLinhas<T extends LinhaGenerica>(lista: T[], dados: Pick<ExcluirLinhasDados, 'ids'>): T[] {
  const ids = new Set(dados.ids);
  return lista.filter((l) => !ids.has(l.id));
}

/** Troca os cômodos (tags) de uma tarefa no mapa tarefa -> tags. */
export function aplicarDefinirClassificacoes(mapa: Map<string, TagItem[]>, dados: DefinirClassificacoesDados): Map<string, TagItem[]> {
  const novo = new Map(mapa);
  if (dados.tags.length === 0) novo.delete(dados.tarefaId);
  else novo.set(dados.tarefaId, dados.tags);
  return novo;
}

/** Troca todas as linhas de um dono (campos e locais de um documento) pelo conjunto novo. */
export function aplicarSubstituirConjunto<T extends LinhaGenerica>(lista: T[], dados: Pick<SubstituirConjuntoDados, 'coluna' | 'vinculoId' | 'linhas'>): T[] {
  return [...lista.filter((l) => l[dados.coluna] !== dados.vinculoId), ...(dados.linhas as unknown as T[])];
}

/** Casal novo: pessoas, vínculos e documentos padrão, nas listas de pessoas e de membros. */
export function aplicarCriarCasal(
  estado: { pessoas: LinhaGenerica[]; membros: LinhaGenerica[] },
  dados: CriarCasalDados
): { pessoas: LinhaGenerica[]; membros: LinhaGenerica[] } {
  const novas = [...dados.pessoas, dados.casal].filter((p) => !estado.pessoas.some((e) => e.id === p.id));
  const membros = dados.membros.filter((m) => !estado.membros.some((e) => e.casal_id === m.casal_id && e.pessoa_id === m.pessoa_id));
  return { pessoas: [...estado.pessoas, ...novas], membros: [...estado.membros, ...(membros as unknown as LinhaGenerica[])] };
}
