import { GerenciadorHierarquia } from '../../components/GerenciadorHierarquia';
import {
  useCategoriasItens,
  useCriarCategoriaItens,
  useExcluirCategoriaItens,
  useRenomearCategoriaItens,
} from '../../hooks/useCategoriasItens';

export function CategoriasItensPage() {
  const { data: categorias, isLoading } = useCategoriasItens();
  const criar = useCriarCategoriaItens();
  const renomear = useRenomearCategoriaItens();
  const excluir = useExcluirCategoriaItens();

  return (
    <div className="settings-secao">
      <h2>Categorias de itens do apartamento</h2>
      <p className="settings-secao-ajuda">Cômodo (nível principal) e subcategoria (eletrodomésticos, móveis, acabamentos...).</p>
      {isLoading ? (
        <p>Carregando…</p>
      ) : (
        <GerenciadorHierarquia
          itens={categorias ?? []}
          rotuloRaiz="Cômodo"
          rotuloFilho="Subcategoria"
          onAdicionarRaiz={(nome) => criar.mutateAsync({ nome, parentId: null })}
          onAdicionarFilho={(parentId, nome) => criar.mutateAsync({ nome, parentId })}
          onRenomear={(id, nome) => renomear.mutateAsync({ id, nome })}
          onExcluir={(id) => excluir.mutateAsync(id)}
        />
      )}
    </div>
  );
}
