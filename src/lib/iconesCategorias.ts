/** Ícones ilustrativos (PNG, bucket `icones`/PNG do Supabase Storage) por
 * categoria raiz — nome exato como semeado na tabela `categorias`. Categorias
 * com mais de um candidato ainda não tiveram o ícone definitivo escolhido.
 * "xícara.png" (candidato de Casa) não está no bucket ainda — falta subir. */
const ICONES_CATEGORIAS: Record<string, string[]> = {
  Moradia: ['casa.png'],
  Mercado: ['compras.png'],
  Restaurantes: ['garfo-colher-placa.png'],
  Transporte: ['taxi.png'],
  Saúde: ['estetoscopio.png', 'rato-injecao.png'],
  'Cuidados pessoais': ['face-mask.png'],
  Compras: ['cabide2.png'],
  Casa: ['cama.png', 'panela.png'],
  Educação: ['estante.png'],
  Lazer: ['games3.png'],
  Viagem: ['aviao.png'],
  Assinaturas: ['compras-celular.png'],
  Pets: ['gato.png', 'pata2.png'],
  'Tarifas e impostos': ['templo.png'],
  Trabalho: ['martelo-juiz.png'],
  Investimentos: ['saco2.png', 'diamante.png'],
  Outros: ['mapa.png', 'alvo.png'],
  Salário: ['bussola.png', 'anvil.png'],
  'Outros Rendimentos': ['ampulheta.png'],
};

export function iconesDaCategoria(nome: string): string[] {
  return (ICONES_CATEGORIAS[nome] ?? []).map((arquivo) => `PNG/${arquivo}`);
}

/** Nomes de arquivo (sem o prefixo "PNG/") usados como ícone de alguma categoria — protegidos contra renomear/excluir na aba Ícones. */
export const ICONES_CATEGORIAS_PROTEGIDOS = new Set(Object.values(ICONES_CATEGORIAS).flat());

/** Subconjunto de ícones que, em vez da ilustração colorida, usa a mesma
 * máscara com currentColor dos ícones de ação (vassoura/salvar/lixeira) —
 * saem como silhueta sólida na cor do texto, não na cor original do PNG. */
const ICONES_MASCARADOS = new Set(
  ['compras.png', 'taxi.png', 'estetoscopio.png', 'rato-injecao.png', 'face-mask.png', 'aviao.png', 'compras-celular.png', 'martelo-juiz.png'].map(
    (arquivo) => `PNG/${arquivo}`
  )
);

export function ehIconeMascarado(arquivo: string): boolean {
  return ICONES_MASCARADOS.has(arquivo);
}
