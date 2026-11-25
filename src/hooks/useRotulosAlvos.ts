import { useCategorias } from './useCategorias';
import { useDocumentosPessoas } from './useDocumentos';
import { useStorageCaixas } from './useStorageCaixas';
import { ABAS_PADRAO } from '../lib/abas';
import { codigoDaCaixa } from '../lib/caixas';
import { definicaoDaFuncao } from '../lib/iconesFuncoes';
import type { AlvoIcone } from '../types';

/** Nome legível de cada alvo de ícone (categoria, subcategoria, aba, função, pessoa ou caixa), para listas e pop-ups. */
export function useRotulosAlvos(): (alvoTipo: AlvoIcone, alvoId: string) => string {
  const { data: despesas = [] } = useCategorias('despesa');
  const { data: receitas = [] } = useCategorias('receita');
  const { data: pessoas = [] } = useDocumentosPessoas();
  const { data: caixas = [] } = useStorageCaixas();
  const categorias = [...despesas, ...receitas];
  const porId = new Map(categorias.map((c) => [c.id, c]));
  const abas = new Map(Object.values(ABAS_PADRAO).flat().map((a) => [a.chave, a.rotulo]));

  return (alvoTipo, alvoId) => {
    if (alvoTipo === 'funcao') return `Função: ${definicaoDaFuncao(alvoId)?.rotulo ?? alvoId}`;
    if (alvoTipo === 'aba') return `Aba: ${abas.get(alvoId) ?? alvoId}`;
    if (alvoTipo === 'pessoa') {
      const pessoa = pessoas.find((p) => p.id === alvoId);
      return pessoa ? `Pessoa: ${pessoa.nome}` : 'Pessoa removida';
    }
    if (alvoTipo === 'caixa') {
      const caixa = caixas.find((c) => c.id === alvoId);
      return caixa ? `Caixa: ${caixa.nome} (${codigoDaCaixa(caixa.numero)})` : 'Caixa removida';
    }
    const cat = porId.get(alvoId);
    if (!cat) return 'Categoria removida';
    const pai = cat.parent_id ? porId.get(cat.parent_id) : null;
    return `Categoria: ${pai ? `${pai.nome} / ${cat.nome}` : cat.nome}`;
  };
}
