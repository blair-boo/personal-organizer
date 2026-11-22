import type { CaixaStorage, ItemStorage } from '../types';

/** Código impresso na etiqueta da caixa (e guardado no rMQR): C-014. */
export function codigoDaCaixa(numero: number): string {
  return `C-${String(numero).padStart(3, '0')}`;
}

/** Número da caixa a partir do texto lido na etiqueta; null se não for um código de caixa. */
export function numeroDoCodigo(texto: string): number | null {
  const m = /^C-(\d+)$/i.exec(texto.trim());
  if (!m) return null;
  const numero = Number(m[1]);
  return Number.isSafeInteger(numero) && numero > 0 ? numero : null;
}

/** Como as caixas e os itens estão dispostos na tela (ids em ordem). */
export interface LayoutCaixas {
  caixas: string[];
  itens: Record<string, string[]>;
}

export function criarLayout(caixas: CaixaStorage[], itens: ItemStorage[]): LayoutCaixas {
  const porCaixa: Record<string, string[]> = {};
  for (const caixa of caixas) porCaixa[caixa.id] = [];
  const ordenados = [...itens].sort((a, b) => a.ordem - b.ordem || a.nome.localeCompare(b.nome, 'pt-BR'));
  for (const item of ordenados) porCaixa[item.storage_id]?.push(item.id);
  return { caixas: caixas.map((c) => c.id), itens: porCaixa };
}

export function caixaDoItem(layout: LayoutCaixas, itemId: string): string | null {
  for (const [caixaId, ids] of Object.entries(layout.itens)) {
    if (ids.includes(itemId)) return caixaId;
  }
  return null;
}

/** Move uma caixa para a posição de outra. */
export function moverCaixa(layout: LayoutCaixas, caixaId: string, paraCaixaId: string): LayoutCaixas {
  const de = layout.caixas.indexOf(caixaId);
  const para = layout.caixas.indexOf(paraCaixaId);
  if (de < 0 || para < 0 || de === para) return layout;
  const caixas = [...layout.caixas];
  caixas.splice(de, 1);
  caixas.splice(para, 0, caixaId);
  return { ...layout, caixas };
}

/**
 * Move um item para uma caixa. `naPosicaoDoItemId` = o item ocupa a posição que
 * esse item tem na caixa de destino (mesmo efeito de arrastar e soltar sobre
 * ele: para baixo fica depois, para cima fica antes); sem ele vai para o fim.
 */
export function moverItem(layout: LayoutCaixas, itemId: string, paraCaixaId: string, naPosicaoDoItemId?: string): LayoutCaixas {
  const origem = caixaDoItem(layout, itemId);
  if (!origem || !layout.itens[paraCaixaId]) return layout;
  const posicao = naPosicaoDoItemId ? layout.itens[paraCaixaId].indexOf(naPosicaoDoItemId) : -1;
  const itens: Record<string, string[]> = { ...layout.itens };
  itens[origem] = itens[origem].filter((id) => id !== itemId);
  const destino = origem === paraCaixaId ? itens[origem] : [...itens[paraCaixaId]];
  destino.splice(posicao < 0 ? destino.length : posicao, 0, itemId);
  itens[paraCaixaId] = destino;
  return { ...layout, itens };
}

/** Mesma disposição de caixas e itens (ids na mesma ordem). */
export function layoutIgual(a: LayoutCaixas, b: LayoutCaixas): boolean {
  if (a.caixas.join('|') !== b.caixas.join('|')) return false;
  return a.caixas.every((id) => (a.itens[id] ?? []).join('|') === (b.itens[id] ?? []).join('|'));
}

export interface OrdensParaSalvar {
  caixas: { id: string; ordem: number }[];
  /** Só os itens cuja caixa ou posição mudou. */
  itens: { id: string; storage_id: string; ordem: number }[];
}

export function ordensParaSalvar(original: LayoutCaixas, atual: LayoutCaixas): OrdensParaSalvar {
  const itens: OrdensParaSalvar['itens'] = [];
  for (const caixaId of atual.caixas) {
    atual.itens[caixaId].forEach((itemId, indice) => {
      const antes = original.itens[caixaId]?.indexOf(itemId) ?? -1;
      if (antes !== indice) itens.push({ id: itemId, storage_id: caixaId, ordem: indice + 1 });
    });
  }
  return { caixas: atual.caixas.map((id, i) => ({ id, ordem: i + 1 })), itens };
}

/** Texto sem acento e em minúsculas, pra comparar na busca. */
function normalizarBusca(texto: string): string {
  return texto
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim();
}

/** Caixas que batem com a busca: pelo nome da caixa, pelo código ou pelo nome de algum item. */
export function idsDeCaixasNaBusca(caixas: CaixaStorage[], itens: ItemStorage[], busca: string): Set<string> {
  const q = normalizarBusca(busca);
  if (!q) return new Set(caixas.map((c) => c.id));
  const itensPorCaixa = new Map<string, string[]>();
  for (const item of itens) {
    const lista = itensPorCaixa.get(item.storage_id) ?? [];
    lista.push(normalizarBusca(item.nome));
    itensPorCaixa.set(item.storage_id, lista);
  }
  const encontradas = new Set<string>();
  for (const caixa of caixas) {
    const naCaixa =
      normalizarBusca(caixa.nome).includes(q) ||
      codigoDaCaixa(caixa.numero).toLowerCase().includes(q) ||
      (itensPorCaixa.get(caixa.id) ?? []).some((nome) => nome.includes(q));
    if (naCaixa) encontradas.add(caixa.id);
  }
  return encontradas;
}

/** Caixas que têm pelo menos um item com alguma das tags (vale qualquer uma). Sem tags escolhidas, todas. */
export function idsDeCaixasComTags(caixas: CaixaStorage[], itens: ItemStorage[], tagIds: string[]): Set<string> {
  if (tagIds.length === 0) return new Set(caixas.map((c) => c.id));
  const encontradas = new Set<string>();
  for (const item of itens) {
    if (item.tag_id && tagIds.includes(item.tag_id)) encontradas.add(item.storage_id);
  }
  return encontradas;
}
