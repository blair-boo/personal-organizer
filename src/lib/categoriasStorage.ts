import type { CategoriaStorage, ItemStorage } from '../types';

function chaveDoNome(nome: string): string {
  return nome.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
}

/** Já existe outra classificação com esse nome (sem diferenciar maiúscula nem acento)? */
export function nomeDeCategoriaDuplicado(nome: string, categorias: CategoriaStorage[], ignorarId?: string): boolean {
  const chave = chaveDoNome(nome);
  return categorias.some((c) => c.id !== ignorarId && chaveDoNome(c.nome) === chave);
}

/** Quantos itens usam cada classificação (id -> quantidade). */
export function contarItensPorCategoria(itens: ItemStorage[]): Map<string, number> {
  const contagem = new Map<string, number>();
  for (const item of itens) {
    if (!item.categoria_id) continue;
    contagem.set(item.categoria_id, (contagem.get(item.categoria_id) ?? 0) + 1);
  }
  return contagem;
}

/** Move uma classificação para a posição de outra (mesmo efeito de arrastar e soltar sobre ela). */
export function moverCategoria(ids: string[], id: string, paraId: string): string[] {
  const de = ids.indexOf(id);
  const para = ids.indexOf(paraId);
  if (de < 0 || para < 0 || de === para) return ids;
  const novo = [...ids];
  novo.splice(de, 1);
  novo.splice(para, 0, id);
  return novo;
}
