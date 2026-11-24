import type { UsoIcone } from '../types';
import { FUNCOES_ICONE, ICONE_CAIXA_PADRAO, ICONE_PLACEHOLDER } from './iconesFuncoes';

/** Pasta do bucket onde ficam as cópias dos ícones em uso: apagar ou renomear a pasta de origem não afeta quem já usa o ícone. */
export const PASTA_EM_USO = 'em-uso';

/** Nome da cópia em `em-uso`: leva a pasta de origem no nome para ícones iguais de pastas diferentes não se sobrescreverem. */
export function nomeCopiaEmUso(pasta: string, arquivo: string): string {
  return `${pasta || 'raiz'}__${arquivo}`;
}

export type TemaEfetivo = 'claro' | 'escuro';

/** Uso válido para o tema atual: o específico do tema, senão o de 'ambos'. */
export function resolverUso(usos: UsoIcone[], alvoTipo: UsoIcone['alvo_tipo'], alvoId: string, tema: TemaEfetivo): UsoIcone | null {
  const doAlvo = usos.filter((u) => u.alvo_tipo === alvoTipo && u.alvo_id === alvoId);
  return doAlvo.find((u) => u.tema === tema) ?? doAlvo.find((u) => u.tema === 'ambos') ?? null;
}

export function caminhoDoUso(uso: Pick<UsoIcone, 'icone_pasta' | 'icone_arquivo'>): string {
  // Mesmo formato de caminhoIcone() em storage.ts, sem importar o cliente do Supabase (mantém este arquivo testável).
  return uso.icone_pasta ? `${uso.icone_pasta}/${uso.icone_arquivo}` : uso.icone_arquivo;
}

/** Tamanho final em px: o padrão do lugar mais a diferença escolhida, nunca menor que 8. */
export function tamanhoDoUso(uso: Pick<UsoIcone, 'tamanho_delta'>, tamanhoBase: number): number {
  return Math.max(8, tamanhoBase + uso.tamanho_delta);
}

/** Valor CSS da cor do ícone, ou undefined quando segue a cor do lugar (currentColor). */
export function corCssDoUso(uso: Pick<UsoIcone, 'mascara' | 'cor_origem' | 'cor_valor'>): string | undefined {
  if (!uso.mascara || uso.cor_origem === 'padrao' || !uso.cor_valor) return undefined;
  return uso.cor_origem === 'app' ? `var(${uso.cor_valor})` : uso.cor_valor;
}

/** Caminhos (pasta/arquivo) usados em alguma tela, mais os padrões de função e o placeholder: saem das seções livres. */
export function arquivosEmUso(usos: UsoIcone[]): Set<string> {
  const emUso = new Set<string>([ICONE_PLACEHOLDER, ICONE_CAIXA_PADRAO]);
  for (const f of FUNCOES_ICONE) if (f.arquivoPadrao) emUso.add(f.arquivoPadrao);
  for (const u of usos) emUso.add(caminhoDoUso(u));
  return emUso;
}

/** Usos de um mesmo ícone (por caminho), só instâncias de UI (categoria/aba). */
export function usosDoIcone(usos: UsoIcone[], caminho: string): UsoIcone[] {
  return usos.filter((u) => u.alvo_tipo !== 'funcao' && caminhoDoUso(u) === caminho);
}

/** Quantas instâncias usam o ícone, contando funções (inclusive o padrão ainda sem linha própria). */
export function contarUsos(usos: UsoIcone[], caminho: string): number {
  const nasLinhas = usos.filter((u) => caminhoDoUso(u) === caminho).length;
  const padroes = FUNCOES_ICONE.filter(
    (f) => f.arquivoPadrao === caminho && !usos.some((u) => u.alvo_tipo === 'funcao' && u.alvo_id === f.chave)
  ).length;
  return nasLinhas + padroes + (caminho === ICONE_PLACEHOLDER ? 1 : 0);
}

/** Erro do Storage quando o arquivo de origem não existe mais (foi apagado ou movido de pasta). */
export function arquivoNaoEncontrado(err: unknown): boolean {
  const mensagem = err instanceof Error ? err.message : typeof err === 'object' && err !== null && 'message' in err ? String((err as { message: unknown }).message) : '';
  return /object not found|not found|404/i.test(mensagem);
}
