interface NoHierarquia {
  id: string;
  nome: string;
  parent_id: string | null;
}

/** Achata uma hierarquia de 2 níveis em opções de <select>, com "Pai › Filho" pros filhos. */
export function construirOpcoesHierarquicas<T extends NoHierarquia>(itens: T[]): { id: string; rotulo: string }[] {
  const opcoes: { id: string; rotulo: string }[] = [];
  const raizes = itens.filter((i) => !i.parent_id);
  for (const raiz of raizes) {
    opcoes.push({ id: raiz.id, rotulo: raiz.nome });
    for (const filho of itens.filter((i) => i.parent_id === raiz.id)) {
      opcoes.push({ id: filho.id, rotulo: `${raiz.nome} › ${filho.nome}` });
    }
  }
  return opcoes;
}

/** Rótulo "Pai › Filho" (ou só o nome, se for raiz) de um item pelo id. */
export function rotuloHierarquico<T extends NoHierarquia>(itens: T[] | undefined, id: string | null): string | null {
  if (!id || !itens) return null;
  const item = itens.find((i) => i.id === id);
  if (!item) return null;
  if (!item.parent_id) return item.nome;
  const pai = itens.find((i) => i.id === item.parent_id);
  return pai ? `${pai.nome} › ${item.nome}` : item.nome;
}
