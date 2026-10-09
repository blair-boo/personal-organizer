import type { UsoIcone } from '../types';

export type FuncaoIcone =
  | 'salvar'
  | 'editar'
  | 'excluir'
  | 'adicionar'
  | 'mover'
  | 'copiar'
  | 'fechar'
  | 'confirmar'
  | 'atualizar'
  | 'selecionar'
  | 'exportar'
  | 'editar_abas';

export interface DefinicaoFuncao {
  chave: FuncaoIcone;
  rotulo: string;
  /** Arquivo padrão na raiz do bucket `icones`; null = ainda sem arquivo (usa o substituto de IconesProvisorios.tsx). */
  arquivoPadrao: string | null;
}

/** Funções com ícone único em todo o app. A ordem é a de exibição em Ícones (Settings). */
export const FUNCOES_ICONE: DefinicaoFuncao[] = [
  { chave: 'salvar', rotulo: 'Salvar', arquivoPadrao: 'save.svg' },
  { chave: 'editar', rotulo: 'Editar', arquivoPadrao: 'broomstick.svg' },
  { chave: 'excluir', rotulo: 'Excluir', arquivoPadrao: 'trash3.svg' },
  { chave: 'adicionar', rotulo: 'Adicionar', arquivoPadrao: null },
  { chave: 'mover', rotulo: 'Mover', arquivoPadrao: null },
  { chave: 'copiar', rotulo: 'Copiar', arquivoPadrao: null },
  { chave: 'fechar', rotulo: 'Fechar', arquivoPadrao: null },
  { chave: 'confirmar', rotulo: 'Confirmar', arquivoPadrao: null },
  { chave: 'atualizar', rotulo: 'Atualizar', arquivoPadrao: null },
  { chave: 'selecionar', rotulo: 'Selecionar', arquivoPadrao: null },
  { chave: 'exportar', rotulo: 'Exportar', arquivoPadrao: null },
  { chave: 'editar_abas', rotulo: 'Editar abas', arquivoPadrao: 'UI_Icon_UGCComponent_Effect.png' },
];

/** Ícone que ocupa o lugar de uma categoria ou aba sem ícone, só no modo de edição. Fica na raiz do bucket. */
export const ICONE_PLACEHOLDER = 'Component_Randomized Pinpoint.png';

export function definicaoDaFuncao(chave: string): DefinicaoFuncao | undefined {
  return FUNCOES_ICONE.find((f) => f.chave === chave);
}

/** Uso padrão de uma função enquanto não houver linha própria em icones_usos. */
export function usoPadraoDaFuncao(chave: string): UsoIcone | null {
  const def = definicaoDaFuncao(chave);
  if (!def?.arquivoPadrao) return null;
  return {
    alvo_tipo: 'funcao',
    alvo_id: def.chave,
    icone_pasta: '',
    icone_arquivo: def.arquivoPadrao,
    tamanho_delta: 0,
    mascara: true,
    cor_origem: 'padrao',
    cor_valor: null,
    tema: 'ambos',
  };
}
