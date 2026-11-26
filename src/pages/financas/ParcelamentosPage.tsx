import { useMemo } from 'react';
import { BotaoVoltar } from '../../components/BotaoVoltar';
import { formatarData, formatarMoeda } from '../../lib/datas';
import { SeletorEscopoFinancas } from '../../components/SeletorEscopoFinancas';
import { useContas } from '../../hooks/useContas';
import { useEscopoFinancas } from '../../hooks/useEscopoFinancas';
import { useLancamentosParcelados } from '../../hooks/useResumoFinanceiro';
import { lancamentosDoEscopo } from '../../lib/financas';

export function ParcelamentosPage() {
  const { escopo, meuId } = useEscopoFinancas();
  const { data: contas } = useContas();
  const { data: lancamentosVisiveis, isLoading, isError } = useLancamentosParcelados();
  const lancamentos = useMemo(
    () => lancamentosDoEscopo(lancamentosVisiveis ?? [], contas ?? [], escopo, meuId),
    [lancamentosVisiveis, contas, escopo, meuId]
  );

  const compras = useMemo(() => {
    const mapa = new Map<
      string,
      { descricao: string; valorParcela: number; parcelaTotal: number; ultimaParcelaVista: number; ultimaData: string }
    >();
    for (const l of lancamentos ?? []) {
      if (!l.parcela_total) continue;
      const chave = `${l.descricao_normalizada}:${l.valor}:${l.parcela_total}`;
      const atual = mapa.get(chave);
      if (!atual || (l.parcela_atual ?? 0) > atual.ultimaParcelaVista) {
        mapa.set(chave, {
          descricao: l.descricao_original,
          valorParcela: l.valor,
          parcelaTotal: l.parcela_total,
          ultimaParcelaVista: l.parcela_atual ?? 0,
          ultimaData: l.data,
        });
      }
    }
    return [...mapa.values()]
      .filter((c) => c.ultimaParcelaVista < c.parcelaTotal)
      .sort((a, b) => b.ultimaData.localeCompare(a.ultimaData));
  }, [lancamentos]);

  if (isLoading) return (
    <>
      <BotaoVoltar />
      <SeletorEscopoFinancas />
      <p>Carregando…</p>
    </>
  );
  if (isError) return (
    <>
      <BotaoVoltar />
      <SeletorEscopoFinancas />
      <p className="hierarquia-vazio">Não foi possível carregar os parcelamentos. Tente de novo.</p>
    </>
  );
  if (compras.length === 0) return (
    <>
      <BotaoVoltar />
      <SeletorEscopoFinancas />
      <p className="hierarquia-vazio">Nenhum parcelamento em andamento.</p>
    </>
  );

  return (
    <>
    <BotaoVoltar />
    <SeletorEscopoFinancas />
    <ul className="lista-lancamentos lista-parcelamentos">
      {compras.map((c, i) => {
        const parcelasRestantes = c.parcelaTotal - c.ultimaParcelaVista;
        return (
          <li key={i}>
            <div>
              <strong>{c.descricao}</strong>
              <span className="conta-detalhe">
                Parcela {c.ultimaParcelaVista}/{c.parcelaTotal} · última em {formatarData(c.ultimaData)}
              </span>
            </div>
            <div>
              <span>{formatarMoeda(c.valorParcela)}/mês</span>
              <span className="conta-detalhe">
                Faltam {parcelasRestantes}× ({formatarMoeda(parcelasRestantes * c.valorParcela)})
              </span>
            </div>
          </li>
        );
      })}
    </ul>
    </>
  );
}
