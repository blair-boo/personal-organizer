import { useMemo } from 'react';
import { IconeSupabase } from '../../components/IconeSupabase';
import { useDialogos } from '../../components/Dialogo';
import { useToast } from '../../components/Toast';
import { mensagemDeErro } from '../../lib/erros';
import { formatarData } from '../../lib/datas';
import { construirOpcoesHierarquicas, rotuloHierarquico } from '../../lib/hierarquia';
import { useCategorias } from '../../hooks/useCategorias';
import { useAtualizarCategoriaRegra, useExcluirRegra, useTodasRegras } from '../../hooks/useRegrasCategorizacao';

export function BancoDeLancamentosPage() {
  const { data: regras, isLoading } = useTodasRegras();
  const { data: categoriasDespesa } = useCategorias('despesa');
  const { data: categoriasReceita } = useCategorias('receita');
  const excluir = useExcluirRegra();
  const atualizarCategoria = useAtualizarCategoriaRegra();
  const { confirmar } = useDialogos();
  const { mostrarToast } = useToast();

  const todasCategorias = useMemo(() => [...(categoriasDespesa ?? []), ...(categoriasReceita ?? [])], [categoriasDespesa, categoriasReceita]);
  const opcoesDespesa = construirOpcoesHierarquicas(categoriasDespesa ?? []);
  const opcoesReceita = construirOpcoesHierarquicas(categoriasReceita ?? []);

  async function remover(id: string, descricao: string) {
    const ok = await confirmar({
      titulo: 'Esquecer essa regra?',
      mensagem: `Da próxima vez que aparecer um lançamento parecido com "${descricao}", vou perguntar a categoria de novo.`,
      confirmarRotulo: 'Esquecer',
      perigoso: true,
    });
    if (!ok) return;
    try {
      await excluir.mutateAsync(id);
    } catch (err) {
      mostrarToast(mensagemDeErro(err), 'erro');
    }
  }

  async function mudarCategoria(id: string, categoriaId: string) {
    try {
      await atualizarCategoria.mutateAsync({ id, categoriaId });
      mostrarToast('Regra atualizada.');
    } catch (err) {
      mostrarToast(mensagemDeErro(err), 'erro');
    }
  }

  return (
    <div className="settings-secao">
      <h2>Banco de lançamentos</h2>
      <p className="settings-secao-ajuda">
        Toda vez que você categoriza um lançamento na importação, a escolha fica salva aqui — da próxima vez que
        aparecer uma descrição parecida, a categoria já vem preenchida sozinha.
      </p>
      {isLoading ? (
        <p>Carregando…</p>
      ) : (
        <ul className="lista-contas">
          {(regras ?? []).map((regra) => (
            <li key={regra.id}>
              <div>
                <strong>{regra.descricao_normalizada}</strong>
                <span className="conta-detalhe">
                  {rotuloHierarquico(todasCategorias, regra.categoria_id) ?? 'Categoria excluída'} · usada em{' '}
                  {formatarData(regra.ultima_utilizacao.slice(0, 10))}
                </span>
              </div>
              <div className="hierarquia-item-acoes">
                <select value={regra.categoria_id} onChange={(e) => mudarCategoria(regra.id, e.target.value)}>
                  <optgroup label="Despesas">
                    {opcoesDespesa.map((o) => (
                      <option key={o.id} value={o.id}>
                        {o.rotulo}
                      </option>
                    ))}
                  </optgroup>
                  <optgroup label="Receitas">
                    {opcoesReceita.map((o) => (
                      <option key={o.id} value={o.id}>
                        {o.rotulo}
                      </option>
                    ))}
                  </optgroup>
                </select>
                <button
                  type="button"
                  className="btn-icone btn-icone-perigo"
                  onClick={() => remover(regra.id, regra.descricao_normalizada)}
                  aria-label="Esquecer"
                >
                  <IconeSupabase arquivo="trash3.svg" />
                </button>
              </div>
            </li>
          ))}
          {regras?.length === 0 && <p className="hierarquia-vazio">Nenhuma regra aprendida ainda — categorize alguns lançamentos que elas vão aparecer aqui.</p>}
        </ul>
      )}
    </div>
  );
}
