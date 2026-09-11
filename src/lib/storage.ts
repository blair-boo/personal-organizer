import { supabase } from './supabaseClient';

/** Normaliza texto pra usar em nome de arquivo: sem acento, minúsculo, espaços viram hífen. */
export function slugify(texto: string): string {
  return texto
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function extensaoDe(nomeArquivo: string): string {
  const partes = nomeArquivo.split('.');
  return partes.length > 1 ? partes[partes.length - 1].toLowerCase() : 'pdf';
}

export async function enviarArquivo(bucket: string, caminho: string, arquivo: File): Promise<void> {
  const { error } = await supabase.storage.from(bucket).upload(caminho, arquivo, { upsert: true });
  if (error) throw error;
}

export async function obterUrlAssinada(bucket: string, caminho: string, expiraEmSegundos = 3600): Promise<string> {
  const { data, error } = await supabase.storage.from(bucket).createSignedUrl(caminho, expiraEmSegundos);
  if (error) throw error;
  return data.signedUrl;
}

export async function removerArquivo(bucket: string, caminho: string): Promise<void> {
  const { error } = await supabase.storage.from(bucket).remove([caminho]);
  if (error) throw error;
}

/** Caminho de um documento de item (nota fiscal/manual/outro), seguindo a convenção {nome}_nf / _manual / _outros. */
export function caminhoDocumentoItem(itemId: string, nomeItem: string, tipo: 'nota_fiscal' | 'manual' | 'outro', arquivo: File): string {
  const slug = slugify(nomeItem);
  const ext = extensaoDe(arquivo.name);
  const sigla = tipo === 'nota_fiscal' ? 'nf' : tipo === 'manual' ? 'manual' : `outros-${Date.now()}`;
  return `${itemId}/${slug}_${sigla}.${ext}`;
}

/** Caminho de um anexo de projeto, seguindo a convenção projeto_{descricao do anexo}. */
export function caminhoAnexoProjeto(projetoId: string, descricaoAnexo: string, arquivo: File): string {
  const slug = slugify(descricaoAnexo) || 'anexo';
  const ext = extensaoDe(arquivo.name);
  return `${projetoId}/projeto_${slug}-${Date.now()}.${ext}`;
}

/** Caminho de um comprovante financeiro (fatura/extrato), seguindo a convenção fatura_/extrato_{sigla}_{banco}_{AA-MM}. */
export function caminhoComprovante(
  contaId: string,
  prefixo: string,
  banco: string,
  siglaCompetencia: string,
  arquivo: File
): string {
  const ext = extensaoDe(arquivo.name);
  return `${contaId}/${prefixo}_${slugify(banco)}_${siglaCompetencia}.${ext}`;
}
