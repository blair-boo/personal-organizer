import { useMemo } from 'react';
import { useParams } from 'react-router-dom';
import { formatarMoeda } from '../../lib/datas';
import { rotuloHierarquico } from '../../lib/hierarquia';
import { useContas } from '../../hooks/useContas';
import { useCategorias } from '../../hooks/useCategorias';
import { useLancamentosPeriodo } from '../../hooks/useResumoFinanceiro';

export function ResumoMesPage() {
  const { competencia } = useParams<{ competencia: string }>();
  const { data: lancamentos, isLoading } = useLancamentosPeriodo(`${competencia}-01`, `${competencia}-31`);
  const { data: contas } = useContas();
  const { data: categoriasDespesa } = useCategorias('despesa');
  const { data: categoriasReceita } = useCategorias('receita');

  const contaPorId = useMemo(() => new Map((contas ?? []).map((c) => [c.id, c])), [contas]);

  const resumo = useMemo(() => {
    let totalEntradas = 0;
    let totalSaidas = 0;
    let totalContaCorrente = 0;
    let totalCartao = 0;
    const porCategoria = new Map<string, { rotulo: string; total: number }>();

    for (const l of lancamentos ?? []) {
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

  if (isLoading) return <p>Carregando…</p>;
  if ((lancamentos?.length ?? 0) === 0) return <p className="hierarquia-vazio">Nenhum lançamento neste mês ainda.</p>;

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
