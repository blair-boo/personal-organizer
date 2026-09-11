import { useMemo } from 'react';

interface EventoCalendario {
  data: string; // "AAAA-MM-DD"
  rotulo: string;
}

const DIAS_SEMANA = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S'];

/** Calendário mensal simples (grid 7 colunas), sem dependência externa. */
export function CalendarioMensal({ ano, mes, eventos }: { ano: number; mes: number; eventos: EventoCalendario[] }) {
  const celulas = useMemo(() => {
    const primeiroDiaSemana = new Date(ano, mes - 1, 1).getDay();
    const totalDias = new Date(ano, mes, 0).getDate();
    const eventosPorDia = new Map<number, string[]>();
    for (const ev of eventos) {
      const dia = Number(ev.data.split('-')[2]);
      const lista = eventosPorDia.get(dia) ?? [];
      lista.push(ev.rotulo);
      eventosPorDia.set(dia, lista);
    }
    const lista: { dia: number | null; rotulos: string[] }[] = [];
    for (let i = 0; i < primeiroDiaSemana; i++) lista.push({ dia: null, rotulos: [] });
    for (let dia = 1; dia <= totalDias; dia++) lista.push({ dia, rotulos: eventosPorDia.get(dia) ?? [] });
    return lista;
  }, [ano, mes, eventos]);

  return (
    <div className="calendario">
      <div className="calendario-cabecalho">
        {DIAS_SEMANA.map((d, i) => (
          <span key={i}>{d}</span>
        ))}
      </div>
      <div className="calendario-grid">
        {celulas.map((c, i) => (
          <div key={i} className={c.dia === null ? 'calendario-celula calendario-celula-vazia' : 'calendario-celula'}>
            {c.dia !== null && (
              <>
                <span className="calendario-dia">{c.dia}</span>
                {c.rotulos.map((r, j) => (
                  <span key={j} className="calendario-evento" title={r}>
                    {r}
                  </span>
                ))}
              </>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
