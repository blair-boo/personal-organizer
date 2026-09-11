/**
 * Chave de categorização de uma descrição de lançamento: minúscula, sem
 * acento, sem a parcela ("3/12" no final) — assim "AMAZON 01/12" e
 * "AMAZON 02/12" caem na mesma regra em `regras_categorizacao`.
 */
export function normalizarDescricao(descricao: string): string {
  return descricao
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/\s*\d{1,2}\s*\/\s*\d{1,2}\s*$/, '')
    .replace(/\s+/g, ' ')
    .trim();
}
