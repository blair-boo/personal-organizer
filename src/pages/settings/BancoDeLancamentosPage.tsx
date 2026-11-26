import { useMemo, useState } from 'react';
import { useAuth } from '../../auth/AuthContext';
import { IconeFuncao } from '../../components/IconeUso';
import { useDialogos } from '../../components/Dialogo';
import { useToast } from '../../components/Toast';
import { mensagemDeErro } from '../../lib/erros';
import { formatarData } from '../../lib/datas';
import { construirOpcoesHierarquicas, rotuloHierarquico } from '../../lib/hierarquia';
import { useCategorias } from '../../hooks/useCategorias';
import { useAtualizarCategoriaRegra, useExcluirRegra, useTodasRegras, type RegraCategorizacao } from '../../hooks/useRegrasCategorizacao';
import { useFinancasAcessos } from '../../hooks/useFinancasAcessos';
import { useNomesUsuarios } from '../../hooks/useNomesUsuarios';

/** Valor do filtro: todas, as do Conjunto ou as de um login (o id). */
const FILTRO_TODAS = 'todas';
const FILTRO_CONJUNTO = 'conjunto';

export function BancoDeLancamentosPage() {
  const meuId = useAuth().session?.user.id;
  const nomeDe = useNomesUsuarios();
  const { data: acessos } = useFinancasAcessos();
  const { data: regras, isLoading, isError } = useTodasRegras();
  const [filtro, setFiltro] = useState(FILTRO_TODAS);
  const { data: categoriasDespesa } = useCategorias('despesa');
  const { data: categoriasReceita } = useCategorias('receita');
  const excluir = useExcluirRegra();
  const atualizarCategoria = useAtualizarCategoriaRegra();
  const { confirmar } = useDialogos();
  const { mostrarToast } = useToast();

  const todasCategorias = useMemo(() => [...(categoriasDespesa ?? []), ...(categoriasReceita ?? [])], [categoriasDespesa, categoriasReceita]);
  const opcoesDespesa = construirOpcoesHierarquicas(categoriasDespesa ?? []);
  const opcoesReceita = construirOpcoesHierarquicas(categoriasReceita ?? []);

  // Quem aparece no filtro: eu, o Conjunto e quem tem regras visíveis para mim.
  const donosNoFiltro = useMemo(() => {
    const ids = new Set<string>(meuId ? [meuId] : []);
    for (const r of regras ?? []) if (r.dono_id) ids.add(r.dono_id);
    return [...ids];
  }, [regras, meuId]);

  const regrasFiltradas = useMemo(
    () =>
      (regras ?? []).filter((r) => {
        if (filtro === FILTRO_TODAS) return true;
        if (filtro === FILTRO_CONJUNTO) return r.dono_id === null;
        return r.dono_id === filtro;
      }),
    [regras, filtro]
  );

  function origemDaRegra(regra: RegraCategorizacao): string {
    if (regra.dono_id === null) return 'Conjunto';
    return regra.dono_id === meuId ? 'Minha' : `De ${nomeDe(regra.dono_id)}`;
  }

  /** Regra do Conjunto e as minhas eu altero; as de outra pessoa só com acesso "editar". */
  function podeAlterar(regra: RegraCategorizacao): boolean {
    if (regra.dono_id === null || regra.dono_id === meuId) return true;
    return (acessos ?? []).some((a) => a.dono_id === regra.dono_id && a.convidado_id === meuId && a.nivel === 'editar');
  }

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
      <label>
        Mostrar regras de
        <select value={filtro} onChange={(e) => setFiltro(e.target.value)}>
          <option value={FILTRO_TODAS}>Todas</option>
          {donosNoFiltro.map((id) => (
            <option key={id} value={id}>
              {id === meuId ? 'Minhas' : nomeDe(id)}
            </option>
          ))}
          <option value={FILTRO_CONJUNTO}>Conjunto</option>
        </select>
      </label>
      {isLoading ? (
        <p>Carregando…</p>
      ) : isError ? (
        <p className="hierarquia-vazio">Não foi possível carregar as regras. Tente de novo.</p>
      ) : (
        <ul className="lista-contas">
          {regrasFiltradas.map((regra) => (
            <li key={regra.id}>
              <div>
                <strong>{regra.descricao_normalizada}</strong>
                <span className="conta-detalhe">
                  {rotuloHierarquico(todasCategorias, regra.categoria_id) ?? 'Categoria excluída'} · usada em{' '}
                  {formatarData(regra.ultima_utilizacao.slice(0, 10))} · {origemDaRegra(regra)}
                </span>
              </div>
              <div className="hierarquia-item-acoes">
                <select
                  value={regra.categoria_id}
                  onChange={(e) => mudarCategoria(regra.id, e.target.value)}
                  disabled={!podeAlterar(regra)}
                  aria-label={`Categoria da regra ${regra.descricao_normalizada}`}
                >
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
                  disabled={!podeAlterar(regra)}
                  onClick={() => remover(regra.id, regra.descricao_normalizada)}
                  title="Esquecer regra"
                  aria-label="Esquecer regra"
                >
                  <IconeFuncao funcao="excluir" />
                </button>
              </div>
            </li>
          ))}
          {regrasFiltradas.length === 0 && (
            <p className="hierarquia-vazio">
              {(regras?.length ?? 0) === 0
                ? 'Nenhuma regra aprendida ainda. Categorize alguns lançamentos que elas vão aparecer aqui.'
                : 'Nenhuma regra neste filtro.'}
            </p>
          )}
        </ul>
      )}
    </div>
  );
}
