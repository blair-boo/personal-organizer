import { obterUrlAssinada } from '../storage';
import { lerArquivo } from './arquivos';

const MENSAGEM_NAO_GUARDADO = 'Este arquivo ainda não foi guardado para uso offline. Abra-o uma vez com internet.';
const DURACAO_URL_LOCAL_MS = 5 * 60 * 1000;

function navegadorOffline(): boolean {
  return typeof navigator !== 'undefined' && navigator.onLine === false;
}

/**
 * URL pra abrir o arquivo. Com internet usa a URL assinada de sempre (arquivo
 * mais novo). Sem internet, ou se pedir a URL falhar, abre a cópia guardada no
 * aparelho, se existir.
 */
export async function obterUrlParaAbrir(bucket: string, caminho: string, expiraEmSegundos?: number): Promise<string> {
  if (!navegadorOffline()) {
    try {
      return await obterUrlAssinada(bucket, caminho, expiraEmSegundos);
    } catch (erro) {
      const local = await lerArquivo(bucket, caminho);
      if (!local) throw erro;
      return urlTemporaria(local);
    }
  }
  const local = await lerArquivo(bucket, caminho);
  if (!local) throw new Error(MENSAGEM_NAO_GUARDADO);
  return urlTemporaria(local);
}

/** O arquivo em si (pra baixar): pela internet quando dá, senão a cópia guardada. */
export async function obterBlobDoArquivo(bucket: string, caminho: string, expiraEmSegundos?: number): Promise<Blob> {
  if (!navegadorOffline()) {
    try {
      const resposta = await fetch(await obterUrlAssinada(bucket, caminho, expiraEmSegundos));
      if (resposta.ok) return await resposta.blob();
    } catch {
      // cai pra cópia local
    }
  }
  const local = await lerArquivo(bucket, caminho);
  if (!local) throw new Error(navegadorOffline() ? MENSAGEM_NAO_GUARDADO : 'Não foi possível baixar o arquivo.');
  return local;
}

function urlTemporaria(blob: Blob): string {
  const url = URL.createObjectURL(blob);
  setTimeout(() => URL.revokeObjectURL(url), DURACAO_URL_LOCAL_MS);
  return url;
}
