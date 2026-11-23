import type { GatoVacina } from '../types';
import { criarHooksDeRegistros } from './registrosDoGato';

export interface DadosVacina {
  gato_id: string;
  vacina: string;
  data: string;
  proxima_data: string | null;
}

const hooks = criarHooksDeRegistros<GatoVacina, DadosVacina>('gato_vacinas');

/** Vacinas de todos os gatos: o que foi aplicado e quando é a próxima dose. */
export const useGatoVacinas = hooks.useLista;
export const useIncluirGatoVacina = hooks.useIncluir;
export const useAtualizarGatoVacina = hooks.useAtualizar;
export const useExcluirGatoVacina = hooks.useExcluir;
