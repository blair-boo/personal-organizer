export interface PosicaoNaFolha {
  x: number;
  y: number;
}

export interface FolhaDeEtiquetas {
  largura: number;
  altura: number;
  posicoes: PosicaoNaFolha[];
}

/** Grade de etiquetas: preenche as colunas da esquerda para a direita, linha por linha, com margem em volta. */
export function layoutDaFolha(quantidade: number, colunas: number, larguraCelula: number, alturaCelula: number, margem: number): FolhaDeEtiquetas {
  const linhas = Math.max(1, Math.ceil(quantidade / colunas));
  const posicoes: PosicaoNaFolha[] = [];
  for (let i = 0; i < quantidade; i++) {
    posicoes.push({ x: margem + (i % colunas) * larguraCelula, y: margem + Math.floor(i / colunas) * alturaCelula });
  }
  return { largura: margem * 2 + colunas * larguraCelula, altura: margem * 2 + linhas * alturaCelula, posicoes };
}

function comReticencias(linha: string, cabe: (linha: string) => boolean): string {
  let l = linha;
  while (l.length > 1 && !cabe(`${l}…`)) l = l.slice(0, -1);
  return `${l}…`;
}

/** Quebra o texto em até `maxLinhas` linhas que caibam em `cabe`; a última leva "…" se o texto não coube todo. */
export function quebrarTexto(texto: string, cabe: (linha: string) => boolean, maxLinhas: number): string[] {
  const palavras = texto.trim().split(/\s+/).filter(Boolean);
  const linhas: string[] = [];
  let atual = '';
  let usadas = 0;
  for (const palavra of palavras) {
    const tentativa = atual ? `${atual} ${palavra}` : palavra;
    if (cabe(tentativa) || !atual) {
      atual = tentativa;
      usadas++;
    } else {
      if (linhas.length + 1 >= maxLinhas) break;
      linhas.push(atual);
      atual = palavra;
      usadas++;
    }
  }
  if (atual) linhas.push(atual);
  const cortou = usadas < palavras.length;
  return linhas.map((linha, i) => (!cabe(linha) || (cortou && i === linhas.length - 1) ? comReticencias(linha, cabe) : linha));
}
