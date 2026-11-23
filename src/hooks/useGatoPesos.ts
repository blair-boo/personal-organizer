import type { GatoPeso } from '../types';
import { criarHooksDeRegistros } from './registrosDoGato';

export interface DadosPeso {
  gato_id: string;
  data: string;
  peso_kg: number;
}

const hooks = criarHooksDeRegistros<GatoPeso, DadosPeso>('gato_pesos');

/** Pesagens de todos os gatos. */
export const useGatoPesos = hooks.useLista;
export const useIncluirGatoPeso = hooks.useIncluir;
export const useAtualizarGatoPeso = hooks.useAtualizar;
export const useExcluirGatoPeso = hooks.useExcluir;
