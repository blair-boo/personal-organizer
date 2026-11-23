import type { GatoVermifugo } from '../types';
import { criarHooksDeRegistros } from './registrosDoGato';

export interface DadosVermifugo {
  gato_id: string;
  data: string;
  produto: string;
  proxima_data: string | null;
}

const hooks = criarHooksDeRegistros<GatoVermifugo, DadosVermifugo>('gato_vermifugos');

/** Vermífugos de todos os gatos: quando, qual e quando é o próximo. */
export const useGatoVermifugos = hooks.useLista;
export const useIncluirGatoVermifugo = hooks.useIncluir;
export const useAtualizarGatoVermifugo = hooks.useAtualizar;
export const useExcluirGatoVermifugo = hooks.useExcluir;
