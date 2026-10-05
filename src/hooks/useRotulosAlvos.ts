import { useCategorias } from './useCategorias';
import { ABAS_PADRAO } from '../lib/abas';
import { definicaoDaFuncao } from '../lib/iconesFuncoes';
import type { AlvoIcone } from '../types';

/** Nome legível de cada alvo de ícone (categoria, subcategoria, aba ou função), para listas e pop-ups. */
export function useRotulosAlvos(): (alvoTipo: AlvoIcone, alvoId: string) => string {
  const { data: despesas = [] } = useCategorias('despesa');
  const { data: receitas = [] } = useCategorias('receita');
  const categorias = [...despesas, ...receitas];
  const porId = new Map(categorias.map((c) => [c.id, c]));
  const abas = new Map(Object.values(ABAS_PADRAO).flat().map((a) => [a.chave, a.rotulo]));

  return (alvoTipo, alvoId) => {
    if (alvoTipo === 'funcao') return `Função: ${definicaoDaFuncao(alvoId)?.rotulo ?? alvoId}`;
    if (alvoTipo === 'aba') return `Aba: ${abas.get(alvoId) ?? alvoId}`;
    const cat = porId.get(alvoId);
    if (!cat) return 'Categoria removida';
    const pai = cat.parent_id ? porId.get(cat.parent_id) : null;
    return `Categoria: ${pai ? `${pai.nome} / ${cat.nome}` : cat.nome}`;
  };
}
