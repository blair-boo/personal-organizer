import type { GatoConsulta } from '../types';
import { criarHooksDeRegistros } from './registrosDoGato';

export interface DadosConsulta {
  gato_id: string;
  data: string;
  veterinario: string | null;
  observacao: string | null;
}

const hooks = criarHooksDeRegistros<GatoConsulta, DadosConsulta>('gato_consultas');

/** Consultas de todos os gatos: data, veterinário e observação. */
export const useGatoConsultas = hooks.useLista;
export const useIncluirGatoConsulta = hooks.useIncluir;
export const useAtualizarGatoConsulta = hooks.useAtualizar;
export const useExcluirGatoConsulta = hooks.useExcluir;
