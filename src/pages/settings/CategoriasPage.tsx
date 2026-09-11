import { useState } from 'react';
import { GerenciadorHierarquia } from '../../components/GerenciadorHierarquia';
import {
  useCategorias,
  useCriarCategoria,
  useExcluirCategoria,
  useRenomearCategoria,
} from '../../hooks/useCategorias';
import type { TipoCategoria } from '../../types';

function PainelCategorias({ tipo }: { tipo: TipoCategoria }) {
  const { data: categorias, isLoading } = useCategorias(tipo);
  const criar = useCriarCategoria(tipo);
  const renomear = useRenomearCategoria(tipo);
  const excluir = useExcluirCategoria(tipo);

  if (isLoading) return <p>Carregando…</p>;

  return (
    <GerenciadorHierarquia
      itens={categorias ?? []}
      rotuloRaiz="Categoria"
      rotuloFilho="Subcategoria"
      onAdicionarRaiz={(nome) => criar.mutateAsync({ nome, parentId: null })}
      onAdicionarFilho={(parentId, nome) => criar.mutateAsync({ nome, parentId })}
      onRenomear={(id, nome) => renomear.mutateAsync({ id, nome })}
      onExcluir={(id) => excluir.mutateAsync(id)}
    />
  );
}

export function CategoriasPage() {
  const [aba, setAba] = useState<TipoCategoria>('despesa');

  return (
    <div className="settings-secao">
      <h2>Categorias financeiras</h2>
      <div className="abas-internas">
        <button type="button" className={aba === 'despesa' ? 'ativa' : ''} onClick={() => setAba('despesa')}>
          Despesas
        </button>
        <button type="button" className={aba === 'receita' ? 'ativa' : ''} onClick={() => setAba('receita')}>
          Receitas
        </button>
      </div>
      <PainelCategorias tipo={aba} />
    </div>
  );
}
