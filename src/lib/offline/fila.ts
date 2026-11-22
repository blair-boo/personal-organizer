import { useSyncExternalStore } from 'react';
import { del, get, set } from 'idb-keyval';

/**
 * Fila de alterações feitas sem internet. Fica no IndexedDB do aparelho (aceita
 * Blob e File, então as fotos tiradas sem sinal vão junto) e é enviada em ordem
 * quando a conexão volta (ver enviarFila.ts).
 */

export type TipoOperacao =
  | 'storage.salvarCaixa'
  | 'storage.aplicarEdicao'
  | 'manutencao.inserirExecucao'
  | 'manutencao.atualizarExecucao'
  | 'manutencao.definirPessoasExecucao'
  | 'manutencao.excluirExecucao';

export interface OperacaoPendente {
  id: string;
  tipo: TipoOperacao;
  dados: unknown;
  criadoEm: number;
}

const CHAVE_IDB = 'po-fila-offline';
const EVENTO_ENVIAR = 'po-enviar-fila';

// Toda gravação passa por esta corrente, pra duas alterações seguidas não se atropelarem no ler-e-gravar.
let corrente: Promise<unknown> = Promise.resolve();
function emSerie<T>(tarefa: () => Promise<T>): Promise<T> {
  const proxima = corrente.then(tarefa, tarefa);
  corrente = proxima.catch(() => undefined);
  return proxima;
}

export async function listarFila(): Promise<OperacaoPendente[]> {
  return (await get<OperacaoPendente[]>(CHAVE_IDB)) ?? [];
}

export async function contarFila(): Promise<number> {
  return (await listarFila()).length;
}

export function enfileirar(tipo: TipoOperacao, dados: unknown): Promise<OperacaoPendente> {
  return emSerie(async () => {
    const operacao: OperacaoPendente = { id: crypto.randomUUID(), tipo, dados, criadoEm: Date.now() };
    await set(CHAVE_IDB, [...(await listarFila()), operacao]);
    await atualizarContagem();
    return operacao;
  });
}

export function removerDaFila(id: string): Promise<void> {
  return emSerie(async () => {
    await set(CHAVE_IDB, (await listarFila()).filter((o) => o.id !== id));
    await atualizarContagem();
  });
}

export function limparFila(): Promise<void> {
  return emSerie(async () => {
    await del(CHAVE_IDB);
    await atualizarContagem();
  });
}

// --- Contagem observável (cabeçalho e Settings > App) ---------------------------------

let pendentes = 0;
const ouvintes = new Set<() => void>();
let iniciada = false;

export async function atualizarContagem(): Promise<void> {
  const n = await contarFila();
  if (n === pendentes) return;
  pendentes = n;
  ouvintes.forEach((aviso) => aviso());
}

function assinar(aviso: () => void): () => void {
  ouvintes.add(aviso);
  if (!iniciada) {
    iniciada = true;
    void atualizarContagem();
  }
  return () => ouvintes.delete(aviso);
}

/** Quantas alterações esperam internet para serem enviadas. */
export function usePendentes(): number {
  return useSyncExternalStore(assinar, () => pendentes, () => 0);
}

/** Pede o envio da fila (quem escuta é o OfflineProvider). */
export function pedirEnvioDaFila(): void {
  window.dispatchEvent(new Event(EVENTO_ENVIAR));
}

export function aoPedirEnvio(ouvinte: () => void): () => void {
  window.addEventListener(EVENTO_ENVIAR, ouvinte);
  return () => window.removeEventListener(EVENTO_ENVIAR, ouvinte);
}
