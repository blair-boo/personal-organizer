import { formatarData } from '../../lib/datas';
import { formatarKg, graficoDePeso } from '../../lib/gatos';
import type { GatoPeso } from '../../types';

const LARGURA = 320;
const ALTURA = 120;

/** Tendência do peso do gato: linha entre as pesagens, com o menor e o maior valor. Aparece com 2 ou mais pesagens. */
export function GraficoPeso({ pesos }: { pesos: GatoPeso[] }) {
  const grafico = graficoDePeso(pesos, LARGURA, ALTURA);
  if (!grafico) return <p className="hierarquia-vazio">Com duas ou mais pesagens aparece o gráfico de tendência.</p>;
  const primeiro = grafico.pontos[0];
  const ultimo = grafico.pontos[grafico.pontos.length - 1];
  const descricao = `Peso de ${formatarKg(primeiro.kg)} em ${formatarData(primeiro.data)} a ${formatarKg(ultimo.kg)} em ${formatarData(ultimo.data)}`;
  return (
    <figure className="gatos-grafico">
      <svg viewBox={`0 0 ${LARGURA} ${ALTURA}`} role="img" aria-label={descricao}>
        <polyline className="gatos-grafico-linha" points={grafico.linha} fill="none" />
        {grafico.pontos.map((p) => (
          <circle key={p.id} className="gatos-grafico-ponto" cx={p.x} cy={p.y} r="3.5">
            <title>{`${formatarKg(p.kg)} em ${formatarData(p.data)}`}</title>
          </circle>
        ))}
      </svg>
      <figcaption>
        {formatarData(primeiro.data)} a {formatarData(ultimo.data)} · de {formatarKg(grafico.minimoKg)} a {formatarKg(grafico.maximoKg)}
      </figcaption>
    </figure>
  );
}
