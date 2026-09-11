import { useMemo, useState } from 'react';
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { competenciaAtual, competenciaParaData, formatarMoeda, somarMeses } from '../../lib/datas';
import { useLancamentosPeriodo } from '../../hooks/useResumoFinanceiro';

const OPCOES_PERIODO = [3, 6, 12];

export function ResumoGeralPage() {
  const [meses, setMeses] = useState(6);

  const competencias = useMemo(() => {
    const atual = competenciaAtual();
    return Array.from({ length: meses }, (_, i) => somarMeses(atual, -(meses - 1 - i)));
  }, [meses]);

  const inicio = competenciaParaData(competencias[0]);
  const fim = `${competencias[competencias.length - 1]}-31`;
  const { data: lancamentos, isLoading } = useLancamentosPeriodo(inicio, fim);

  const dadosGrafico = useMemo(() => {
    const porMes = new Map(competencias.map((c) => [c, { competencia: c, entradas: 0, saidas: 0 }]));
    for (const l of lancamentos ?? []) {
      const competencia = l.data.slice(0, 7);
      const bucket = porMes.get(competencia);
      if (!bucket) continue;
      if (l.tipo === 'entrada') bucket.entradas += l.valor;
      else bucket.saidas += l.valor;
    }
    return [...porMes.values()].map((b) => ({ ...b, saldo: b.entradas - b.saidas }));
  }, [lancamentos, competencias]);

  return (
    <div className="resumo-geral">
      <div className="abas-internas">
        {OPCOES_PERIODO.map((n) => (
          <button key={n} type="button" className={meses === n ? 'ativa' : ''} onClick={() => setMeses(n)}>
            {n} meses
          </button>
        ))}
      </div>

      {isLoading ? (
        <p>Carregando…</p>
      ) : (
        <>
          <div className="grafico-resumo-geral">
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={dadosGrafico}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="competencia" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip formatter={(v: number) => formatarMoeda(v)} />
                <Legend />
                <Bar dataKey="entradas" name="Entradas" fill="var(--ok)" />
                <Bar dataKey="saidas" name="Saídas" fill="var(--danger)" />
              </BarChart>
            </ResponsiveContainer>
          </div>

          <table className="tabela-resumo-geral">
            <thead>
              <tr>
                <th>Mês</th>
                <th>Entradas</th>
                <th>Saídas</th>
                <th>Saldo</th>
              </tr>
            </thead>
            <tbody>
              {dadosGrafico.map((m) => (
                <tr key={m.competencia}>
                  <td>{m.competencia}</td>
                  <td className="valor-entrada">{formatarMoeda(m.entradas)}</td>
                  <td className="valor-saida">{formatarMoeda(m.saidas)}</td>
                  <td>{formatarMoeda(m.saldo)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}
    </div>
  );
}
