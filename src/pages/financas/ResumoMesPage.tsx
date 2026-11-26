import { useMemo } from 'react';
import { useParams } from 'react-router-dom';
import { competenciaAtual, formatarData, formatarMoeda, ultimoDiaDaCompetencia } from '../../lib/datas';
import { calcularAcerto, ehDespesaDividida, lancamentosDoEscopo, partesDoLancamento } from '../../lib/financas';
import { rotuloHierarquico } from '../../lib/hierarquia';
import { useContas } from '../../hooks/useContas';
import { useCategorias } from '../../hooks/useCategorias';
import { useEscopoFinancas } from '../../hooks/useEscopoFinancas';
import { useNomesUsuarios } from '../../hooks/useNomesUsuarios';
import { useLancamentosPeriodo } from '../../hooks/useResumoFinanceiro';

export function ResumoMesPage() {
  const { competencia } = useParams<{ competencia: string }>();
  const { escopo, meuId } = useEscopoFinancas();
  const nomeDe = useNomesUsuarios();
  const { data: lancamentosVisiveis, isLoading, isError } = useLancamentosPeriodo(`${competencia}-01`, ultimoDiaDaCompetencia(competencia ?? competenciaAtual()));
  const { data: contas } = useContas();
  const lancamentos = useMemo(
    () => lancamentosDoEscopo(lancamentosVisiveis ?? [], contas ?? [], escopo, meuId),
    [lancamentosVisiveis, contas, escopo, meuId]
  );
  const { data: categoriasDespesa } = useCategorias('despesa');
  const { data: categoriasReceita } = useCategorias('receita');

  const contaPorId = useMemo(() => new Map((contas ?? []).map((c) => [c.id, c])), [contas]);

  const resumo = useMemo(() => {
    let totalEntradas = 0;
    let totalSaidas = 0;
    let totalContaCorrente = 0;
    let totalCartao = 0;
    const porCategoria = new Map<string, { rotulo: string; total: number }>();

    for (const l of lancamentos) {
      const valorComSinal = l.tipo === 'entrada' ? l.valor : -l.valor;
      if (l.tipo === 'entrada') totalEntradas += l.valor;
      else totalSaidas += l.valor;

      const conta = contaPorId.get(l.conta_id);
      if (conta?.tipo === 'cartao_credito') totalCartao += valorComSinal;
      else totalContaCorrente += valorComSinal;

      const categorias = l.tipo === 'entrada' ? categoriasReceita : categoriasDespesa;
      const rotulo = rotuloHierarquico(categorias, l.categoria_id) ?? 'Sem categoria';
      const chave = `${l.tipo}:${l.categoria_id ?? 'sem'}`;
      const atual = porCategoria.get(chave) ?? { rotulo, total: 0 };
      atual.total += valorComSinal;
      porCategoria.set(chave, atual);
    }

    return {
      totalEntradas,
      totalSaidas,
      saldo: totalEntradas - totalSaidas,
      totalContaCorrente,
      totalCartao,
      porCategoria: [...porCategoria.values()].sort((a, b) => a.total - b.total),
    };
  }, [lancamentos, contaPorId, categoriasDespesa, categoriasReceita]);

  // Só no Conjunto: a parte de cada pessoa nas saídas e quem deve a quem (despesas divididas).
  const conjunto = useMemo(() => {
    if (escopo.tipo !== 'conjunto') return null;
    const partes = new Map<string, number>();
    for (const l of lancamentos) {
      if (l.tipo !== 'saida') continue;
      for (const parte of partesDoLancamento(l, contaPorId.get(l.conta_id))) {
        partes.set(parte.usuarioId, (partes.get(parte.usuarioId) ?? 0) + parte.valor);
      }
    }
    return {
      partes: [...partes.entries()].map(([usuarioId, valor]) => ({ usuarioId, valor })),
      acertos: calcularAcerto(lancamentos),
      divididas: lancamentos.filter(ehDespesaDividida),
    };
  }, [escopo.tipo, lancamentos, contaPorId]);

  if (isLoading) return <p>Carregando…</p>;
  if (isError) return <p className="hierarquia-vazio">Não foi possível carregar o resumo. Tente de novo.</p>;
  if (lancamentos.length === 0) {
    return (
      <p className="hierarquia-vazio">
        {escopo.tipo === 'conjunto' ? 'Nenhum lançamento conjunto neste mês ainda.' : 'Nenhum lançamento neste mês ainda.'}
      </p>
    );
  }

  return (
    <div className="resumo-mes">
      <div className="resumo-cartoes">
        <div className="resumo-cartao">
          <span>Entradas</span>
          <strong className="valor-entrada">{formatarMoeda(resumo.totalEntradas)}</strong>
        </div>
        <div className="resumo-cartao">
          <span>Saídas</span>
          <strong className="valor-saida">{formatarMoeda(resumo.totalSaidas)}</strong>
        </div>
        <div className="resumo-cartao">
          <span>Saldo</span>
          <strong>{formatarMoeda(resumo.saldo)}</strong>
        </div>
      </div>

      <div className="resumo-cartoes">
        <div className="resumo-cartao">
          <span>Conta corrente / poupança / investimento</span>
          <strong>{formatarMoeda(resumo.totalContaCorrente)}</strong>
        </div>
        <div className="resumo-cartao">
          <span>Cartão de crédito</span>
          <strong>{formatarMoeda(resumo.totalCartao)}</strong>
        </div>
      </div>

      {conjunto && (
        <>
          <h3>Parte de cada um nas saídas</h3>
          {conjunto.partes.length === 0 ? (
            <p className="hierarquia-vazio">Nenhuma saída dividida neste mês.</p>
          ) : (
            <div className="resumo-cartoes">
              {conjunto.partes.map((p) => (
                <div key={p.usuarioId} className="resumo-cartao">
                  <span>{p.usuarioId === meuId ? 'Minha parte' : `Parte de ${nomeDe(p.usuarioId)}`}</span>
                  <strong className="valor-saida">{formatarMoeda(p.valor)}</strong>
                </div>
              ))}
            </div>
          )}

          <h3>Acerto</h3>
          {conjunto.acertos.length === 0 ? (
            <p className="hierarquia-vazio">Nenhum acerto pendente neste mês.</p>
          ) : (
            <ul className="lista-lancamentos">
              {conjunto.acertos.map((a) => (
                <li key={`${a.devedorId}-${a.credorId}`}>
                  <span>
                    {a.devedorId === meuId ? 'Você deve' : `${nomeDe(a.devedorId)} deve`} a {a.credorId === meuId ? 'você' : nomeDe(a.credorId)}
                  </span>
                  <span className="valor-saida">{formatarMoeda(a.valor)}</span>
                </li>
              ))}
            </ul>
          )}

          <h3>Despesas divididas</h3>
          {conjunto.divididas.length === 0 ? (
            <p className="hierarquia-vazio">Nenhuma despesa dividida neste mês.</p>
          ) : (
            <ul className="lista-lancamentos">
              {conjunto.divididas.map((l) => (
                <li key={l.id}>
                  <div>
                    <span>{formatarData(l.data)}</span> {l.descricao_original}
                    <span className="conta-detalhe">
                      Pago por {l.pagador_id === meuId ? 'você' : nomeDe(l.pagador_id)}, dividido com{' '}
                      {l.conjunto_com === meuId ? 'você' : nomeDe(l.conjunto_com)} ({l.divisao_percentual}% e {100 - l.divisao_percentual}%)
                    </span>
                  </div>
                  <span className={l.tipo === 'entrada' ? 'valor-entrada' : 'valor-saida'}>{formatarMoeda(l.valor)}</span>
                </li>
              ))}
            </ul>
          )}
        </>
      )}

      <h3>Por categoria</h3>
      <ul className="lista-lancamentos">
        {resumo.porCategoria.map((c) => (
          <li key={c.rotulo}>
            <span>{c.rotulo}</span>
            <span className={c.total >= 0 ? 'valor-entrada' : 'valor-saida'}>{formatarMoeda(c.total)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
