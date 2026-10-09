import { del, get, set } from 'idb-keyval';
import type { Query } from '@tanstack/react-query';
import type { PersistedClient, Persister } from '@tanstack/react-query-persist-client';

/**
 * Consultas que ficam guardadas no aparelho pra o app abrir sem internet:
 * Apartamento e Documentos, mais o que a interface precisa pra se desenhar
 * (abas e ícones). Lista fechada de propósito: consulta nova (principalmente de
 * Finanças, que não precisa de offline) só entra aqui se alguém decidir.
 */
const CONSULTAS_OFFLINE = new Set([
  'itens',
  'item_documentos',
  'item_tags',
  'tags_itens',
  'projetos',
  'projeto_anexos',
  'tarefas_manutencao',
  'classificacoes_tarefas',
  'tarefa_classificacoes',
  'documentos',
  'documentos_pessoas',
  'documentos_proximos_vencimentos',
  'documento_campos',
  'documento_locais_renovacao',
  'documento_anexos',
  'abas_config',
  'icones_usos',
]);

/**
 * Quanto tempo o que está guardado vale (e por quanto tempo o react-query mantém
 * consultas sem uso). O limite é o maior atraso que um setTimeout aceita
 * (2^31 - 1 ms, cerca de 24,8 dias): acima disso o temporizador dispara na hora
 * e o react-query descartaria cada consulta assim que ela saísse da tela.
 */
export const VALIDADE_OFFLINE_MS = 24 * 24 * 60 * 60 * 1000;
/** Mudou o formato de alguma consulta guardada? Aumente: o que estava guardado é descartado. */
export const VERSAO_DO_CACHE = 'v1';

const CHAVE_IDB = 'po-react-query-offline';

export function consultaFicaOffline(consulta: Pick<Query, 'queryKey' | 'state'>): boolean {
  const [nome] = consulta.queryKey;
  return consulta.state.status === 'success' && typeof nome === 'string' && CONSULTAS_OFFLINE.has(nome);
}

/** Só pela chave (sem olhar o estado), pra decidir o que invalidar ou apagar. */
export function chaveFicaOffline(queryKey: readonly unknown[]): boolean {
  const [nome] = queryKey;
  return typeof nome === 'string' && CONSULTAS_OFFLINE.has(nome);
}

/**
 * Guarda o cache do react-query no IndexedDB. Nada de JSON: o IndexedDB copia
 * Map e Date como são, e algumas consultas (item_tags, tarefa_classificacoes)
 * devolvem Map.
 */
export function criarPersisterIdb(): Persister {
  return {
    persistClient: (cliente: PersistedClient) => set(CHAVE_IDB, cliente),
    restoreClient: () => get<PersistedClient>(CHAVE_IDB),
    removeClient: () => del(CHAVE_IDB),
  };
}

/** Uma instância só, usada pelo provider do react-query e pela limpeza ao sair. */
export const persisterOffline: Persister = criarPersisterIdb();
