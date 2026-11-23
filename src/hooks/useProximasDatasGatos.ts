import { useMemo } from 'react';
import { hojeIso } from '../lib/datas';
import { proximasDatas, type ProximaData } from '../lib/gatos';
import { useGatoVacinas } from './useGatoVacinas';
import { useGatoVermifugos } from './useGatoVermifugos';
import { useGatos } from './useGatos';

/** Próximas vacinas e vermífugos de todos os gatos (as vencidas primeiro, por data). */
export function useProximasDatasGatos(): ProximaData[] {
  const { data: gatos } = useGatos();
  const { data: vacinas } = useGatoVacinas();
  const { data: vermifugos } = useGatoVermifugos();
  return useMemo(() => proximasDatas(gatos ?? [], vacinas ?? [], vermifugos ?? [], hojeIso()), [gatos, vacinas, vermifugos]);
}
