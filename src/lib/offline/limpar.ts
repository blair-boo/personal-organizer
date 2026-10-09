import type { QueryClient } from '@tanstack/react-query';
import { apagarTodosOsArquivos } from './arquivos';
import { chaveFicaOffline, persisterOffline } from './persistencia';

/** Caches de versões anteriores do app, que guardavam respostas da API e arquivos privados. */
const CACHES_ANTIGOS_COM_DADOS = ['supabase-api-cache', 'storage-cache'];

export const CHAVE_ULTIMA_SINCRONIZACAO = 'po-offline-ultima-sincronizacao';

/**
 * Apaga o que foi guardado no aparelho pra uso offline (consultas e arquivos).
 * O app continua funcionando com internet e vai guardando de novo na próxima
 * sincronização.
 */
export async function apagarDadosOffline(queryClient: QueryClient): Promise<void> {
  await persisterOffline.removeClient();
  await apagarTodosOsArquivos();
  if (typeof caches !== 'undefined') await Promise.all(CACHES_ANTIGOS_COM_DADOS.map((nome) => caches.delete(nome)));
  queryClient.removeQueries({ predicate: (consulta) => chaveFicaOffline(consulta.queryKey) });
  try {
    localStorage.removeItem(CHAVE_ULTIMA_SINCRONIZACAO);
  } catch {
    // armazenamento bloqueado: sem problema
  }
}

/** Ao sair da conta nada de dados pessoais pode ficar no aparelho. */
export async function limparTudoAoSair(queryClient: QueryClient): Promise<void> {
  await apagarDadosOffline(queryClient);
  queryClient.clear();
}
