/**
 * Arquivos dos anexos (itens, projetos e documentos) guardados no aparelho pra
 * abrir sem internet. Ficam no Cache Storage do navegador, numa chave estável
 * (bucket + caminho). Não dá pra confiar no cache do service worker pra isso:
 * os buckets são privados e a URL assinada muda a cada acesso, então a URL
 * nunca se repete.
 *
 * Cada arquivo guarda uma "versão" (o id da linha do anexo). Trocar um arquivo
 * pelo mesmo caminho gera uma linha nova, então a versão muda e o arquivo é
 * baixado de novo.
 */

export interface ArquivoDesejado {
  bucket: string;
  caminho: string;
  /** Muda quando o conteúdo muda (aqui, o id da linha do anexo). */
  versao: string;
}

export const NOME_CACHE_ARQUIVOS = 'arquivos-offline';
const ORIGEM_FALSA = 'https://arquivos-offline.local';
const CABECALHO_VERSAO = 'x-versao';
const CABECALHO_TAMANHO = 'x-tamanho';

type ArmazenamentoDeCaches = Pick<CacheStorage, 'open' | 'delete'>;

function armazenamento(): ArmazenamentoDeCaches | null {
  return typeof caches === 'undefined' ? null : caches;
}

export function urlDoArquivo(bucket: string, caminho: string): string {
  return `${ORIGEM_FALSA}/${encodeURIComponent(bucket)}/${caminho.split('/').map(encodeURIComponent).join('/')}`;
}

function idDaUrl(url: string): string {
  return decodeURIComponent(url.slice(ORIGEM_FALSA.length + 1));
}

export function idDoArquivo(arquivo: Pick<ArquivoDesejado, 'bucket' | 'caminho'>): string {
  return `${arquivo.bucket}/${arquivo.caminho}`;
}

// --- Regras puras ----------------------------------------------------------

interface ConsultaEmCache {
  queryKey: readonly unknown[];
  data: unknown;
}

/** Consulta -> bucket dos anexos dela. */
const BUCKET_POR_CONSULTA: Record<string, string> = {
  item_documentos: 'itens-docs',
  projeto_anexos: 'projetos-anexos',
  documento_anexos: 'confidencial',
};

/** Lê as listas de anexos que já estão no cache do react-query e devolve os arquivos que deveriam estar no aparelho. */
export function extrairArquivosDasConsultas(consultas: ConsultaEmCache[]): ArquivoDesejado[] {
  const encontrados = new Map<string, ArquivoDesejado>();
  for (const consulta of consultas) {
    const nome = consulta.queryKey[0];
    const bucket = typeof nome === 'string' ? BUCKET_POR_CONSULTA[nome] : undefined;
    if (!bucket || !Array.isArray(consulta.data)) continue;
    for (const linha of consulta.data as { id?: string; arquivo_url?: string }[]) {
      if (!linha?.arquivo_url || !linha.id) continue;
      const arquivo = { bucket, caminho: linha.arquivo_url, versao: linha.id };
      encontrados.set(idDoArquivo(arquivo), arquivo);
    }
  }
  return [...encontrados.values()];
}

/** Falta no aparelho ou está numa versão diferente. */
export function arquivosABaixar(desejados: ArquivoDesejado[], guardados: Map<string, string>): ArquivoDesejado[] {
  return desejados.filter((a) => guardados.get(idDoArquivo(a)) !== a.versao);
}

/** Está no aparelho mas não é mais referenciado por nenhum anexo. */
export function idsObsoletos(desejados: ArquivoDesejado[], guardados: Map<string, string>): string[] {
  const ativos = new Set(desejados.map(idDoArquivo));
  return [...guardados.keys()].filter((id) => !ativos.has(id));
}

// --- Cache Storage -----------------------------------------------------------

export async function guardarArquivo(arquivo: ArquivoDesejado, blob: Blob, cs: ArmazenamentoDeCaches | null = armazenamento()): Promise<void> {
  if (!cs) return;
  const cache = await cs.open(NOME_CACHE_ARQUIVOS);
  await cache.put(
    new Request(urlDoArquivo(arquivo.bucket, arquivo.caminho)),
    new Response(blob, {
      headers: {
        'content-type': blob.type || 'application/octet-stream',
        [CABECALHO_VERSAO]: arquivo.versao,
        [CABECALHO_TAMANHO]: String(blob.size),
      },
    })
  );
}

export async function lerArquivo(bucket: string, caminho: string, cs: ArmazenamentoDeCaches | null = armazenamento()): Promise<Blob | null> {
  if (!cs) return null;
  const cache = await cs.open(NOME_CACHE_ARQUIVOS);
  const resposta = await cache.match(new Request(urlDoArquivo(bucket, caminho)));
  return resposta ? resposta.blob() : null;
}

/** id (bucket/caminho) -> versão, de tudo que está guardado. */
export async function versoesGuardadas(cs: ArmazenamentoDeCaches | null = armazenamento()): Promise<Map<string, string>> {
  const mapa = new Map<string, string>();
  if (!cs) return mapa;
  const cache = await cs.open(NOME_CACHE_ARQUIVOS);
  for (const requisicao of await cache.keys()) {
    const resposta = await cache.match(requisicao);
    mapa.set(idDaUrl(requisicao.url), resposta?.headers.get(CABECALHO_VERSAO) ?? '');
  }
  return mapa;
}

export async function estatisticasArquivos(cs: ArmazenamentoDeCaches | null = armazenamento()): Promise<{ arquivos: number; bytes: number }> {
  if (!cs) return { arquivos: 0, bytes: 0 };
  const cache = await cs.open(NOME_CACHE_ARQUIVOS);
  let arquivos = 0;
  let bytes = 0;
  for (const requisicao of await cache.keys()) {
    const resposta = await cache.match(requisicao);
    arquivos++;
    bytes += Number(resposta?.headers.get(CABECALHO_TAMANHO) ?? 0);
  }
  return { arquivos, bytes };
}

export async function removerArquivos(ids: string[], cs: ArmazenamentoDeCaches | null = armazenamento()): Promise<void> {
  if (!cs || ids.length === 0) return;
  const cache = await cs.open(NOME_CACHE_ARQUIVOS);
  for (const id of ids) {
    const barra = id.indexOf('/');
    await cache.delete(new Request(urlDoArquivo(id.slice(0, barra), id.slice(barra + 1))));
  }
}

export async function apagarTodosOsArquivos(cs: ArmazenamentoDeCaches | null = armazenamento()): Promise<void> {
  if (!cs) return;
  await cs.delete(NOME_CACHE_ARQUIVOS);
}

export interface ResultadoSincronizacaoArquivos {
  baixados: number;
  /** ids (bucket/caminho) que não deu pra baixar nesta rodada; a próxima tenta de novo. */
  falhas: string[];
}

/** Baixa o que falta, poucos por vez. Falha de um arquivo não interrompe os outros. */
export async function sincronizarArquivos(
  desejados: ArquivoDesejado[],
  baixar: (arquivo: ArquivoDesejado) => Promise<Blob>,
  cs: ArmazenamentoDeCaches | null = armazenamento(),
  simultaneos = 3
): Promise<ResultadoSincronizacaoArquivos> {
  const fila = arquivosABaixar(desejados, await versoesGuardadas(cs));
  const resultado: ResultadoSincronizacaoArquivos = { baixados: 0, falhas: [] };
  const trabalhadores = Array.from({ length: Math.min(simultaneos, fila.length) }, async () => {
    for (let arquivo = fila.shift(); arquivo; arquivo = fila.shift()) {
      try {
        await guardarArquivo(arquivo, await baixar(arquivo), cs);
        resultado.baixados++;
      } catch {
        resultado.falhas.push(idDoArquivo(arquivo));
      }
    }
  });
  await Promise.all(trabalhadores);
  return resultado;
}
