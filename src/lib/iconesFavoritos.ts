import type { IconeArquivo, IconeFavorito, PastaIcones } from '../types';

/** Chave de um ícone da galeria: pasta e arquivo ('' = raiz do bucket). Mesmo formato do caminho no Storage. */
export function chaveIcone(pasta: string, arquivo: string): string {
  return pasta ? `${pasta}/${arquivo}` : arquivo;
}

export function conjuntoDeFavoritos(favoritos: IconeFavorito[]): Set<string> {
  return new Set(favoritos.map((f) => chaveIcone(f.pasta, f.arquivo)));
}

export interface IconeDaGaleria {
  pasta: string;
  icone: IconeArquivo;
}

/**
 * Favoritos que ainda existem na galeria, de todas as pastas juntas, na ordem das pastas.
 * Favorito de arquivo movido, renomeado ou apagado não aparece.
 */
export function favoritosExistentes(pastas: PastaIcones[], favoritos: Set<string>): IconeDaGaleria[] {
  return pastas.flatMap(({ pasta, icones }) => icones.filter((i) => favoritos.has(chaveIcone(pasta, i.nome))).map((icone) => ({ pasta, icone })));
}
