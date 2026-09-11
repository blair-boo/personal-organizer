import { useMemo } from 'react';
import { formatarData, formatarMoeda } from '../../lib/datas';
import { useLancamentosParcelados } from '../../hooks/useResumoFinanceiro';

export function ParcelamentosPage() {
  const { data: lancamentos, isLoading } = useLancamentosParcelados();

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

  if (isLoading) return <p>Carregando…</p>;
  if (compras.length === 0) return <p className="hierarquia-vazio">Nenhum parcelamento em andamento.</p>;

  return (
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
  );
}
