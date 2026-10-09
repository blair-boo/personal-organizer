import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useIsRestoring, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../auth/AuthContext';
import { useOnline } from '../hooks/useOnline';
import { urlIconeSupabase } from './IconeSupabase';
import { caminhoDoUso } from '../lib/iconesUsos';
import {
  apagarTodosOsArquivos,
  estatisticasArquivos,
  extrairArquivosDasConsultas,
  idsObsoletos,
  removerArquivos,
  sincronizarArquivos,
  versoesGuardadas,
  type ArquivoDesejado,
} from '../lib/offline/arquivos';
import { apagarDadosOffline, CHAVE_ULTIMA_SINCRONIZACAO } from '../lib/offline/limpar';
import { chaveFicaOffline } from '../lib/offline/persistencia';
import { supabase } from '../lib/supabaseClient';
import type { UsoIcone } from '../types';
import { AquecimentoOffline } from './AquecimentoOffline';

/** Se voltar pro app depois disso sem ter sincronizado, sincroniza de novo. */
const REVALIDAR_APOS_MS = 30 * 60 * 1000;
/** Espera depois de uma mudança em anexos antes de baixar o arquivo novo. */
const ESPERA_ARQUIVO_NOVO_MS = 2000;
const CONSULTAS_DE_ANEXOS = new Set(['item_documentos', 'projeto_anexos', 'documento_anexos']);

interface OpcoesSincronizacao {
  /** Apaga os arquivos guardados e baixa tudo de novo (o equivalente ao Hard Sync). */
  recarregarTudo?: boolean;
}

interface EstadoOffline {
  online: boolean;
  sincronizando: boolean;
  ultimaSincronizacao: Date | null;
  arquivos: { arquivos: number; bytes: number };
  /** null = o navegador não informa. */
  armazenamentoProtegido: boolean | null;
  sincronizarAgora: (opcoes?: OpcoesSincronizacao) => Promise<void>;
  apagarDadosOffline: () => Promise<void>;
}

const OfflineContext = createContext<EstadoOffline | null>(null);

function lerUltimaSincronizacao(): Date | null {
  try {
    const bruto = localStorage.getItem(CHAVE_ULTIMA_SINCRONIZACAO);
    return bruto ? new Date(bruto) : null;
  } catch {
    return null;
  }
}

async function baixarDoStorage(arquivo: ArquivoDesejado): Promise<Blob> {
  const { data, error } = await supabase.storage.from(arquivo.bucket).download(arquivo.caminho);
  if (error) throw error;
  return data;
}

/**
 * Mantém Apartamento e Documentos disponíveis sem internet: com internet, busca
 * as consultas e baixa os anexos pro aparelho (ao abrir o app, quando a conexão
 * volta e ao voltar pro app depois de um tempo). Sem internet não faz nada: o
 * app usa o que já está guardado.
 */
export function OfflineProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const { session } = useAuth();
  const online = useOnline();
  const restaurando = useIsRestoring();

  const [aquecendo, setAquecendo] = useState(false);
  const [sincronizando, setSincronizando] = useState(false);
  const [ultimaSincronizacao, setUltimaSincronizacao] = useState<Date | null>(lerUltimaSincronizacao);
  const [arquivos, setArquivos] = useState({ arquivos: 0, bytes: 0 });
  const [armazenamentoProtegido, setArmazenamentoProtegido] = useState<boolean | null>(null);

  const emAndamento = useRef(false);
  const terminouAquecimento = useRef<(() => void) | null>(null);
  const aoTerminarAquecimento = useCallback(() => terminouAquecimento.current?.(), []);

  const atualizarEstatisticas = useCallback(async () => setArquivos(await estatisticasArquivos()), []);

  const desejadosNoCache = useCallback((): ArquivoDesejado[] => {
    const consultas = queryClient.getQueryCache().getAll().map((q) => ({ queryKey: q.queryKey, data: q.state.data }));
    return extrairArquivosDasConsultas(consultas);
  }, [queryClient]);

  /** Faz o navegador baixar (e o service worker guardar) os ícones usados, que ficam em URL pública estável. */
  const aquecerIcones = useCallback(async () => {
    const usos = queryClient.getQueryData<UsoIcone[]>(['icones_usos']) ?? [];
    await Promise.allSettled(usos.map((uso) => fetch(urlIconeSupabase(caminhoDoUso(uso)))));
  }, [queryClient]);

  const sincronizarAgora = useCallback(
    async ({ recarregarTudo = false }: OpcoesSincronizacao = {}) => {
      if (!navigator.onLine || emAndamento.current) return;
      emAndamento.current = true;
      setSincronizando(true);
      try {
        if (recarregarTudo) await apagarTodosOsArquivos();
        // Marca tudo como velho (e atualiza o que está na tela); o que está fora da tela é buscado pelo aquecimento.
        await queryClient.invalidateQueries({ predicate: (q) => chaveFicaOffline(q.queryKey) });
        await new Promise<void>((resolve) => {
          terminouAquecimento.current = resolve;
          setAquecendo(true);
        });
        setAquecendo(false);
        terminouAquecimento.current = null;

        const desejados = desejadosNoCache();
        await sincronizarArquivos(desejados, baixarDoStorage);
        // Arquivo cujo anexo foi removido no servidor não precisa mais ficar no aparelho.
        await removerArquivos(idsObsoletos(desejados, await versoesGuardadas()));
        await aquecerIcones();
        await atualizarEstatisticas();

        const agora = new Date();
        setUltimaSincronizacao(agora);
        try {
          localStorage.setItem(CHAVE_ULTIMA_SINCRONIZACAO, agora.toISOString());
        } catch {
          // armazenamento bloqueado: só não lembra a hora depois de recarregar
        }
      } finally {
        setAquecendo(false);
        setSincronizando(false);
        emAndamento.current = false;
      }
    },
    [queryClient, desejadosNoCache, aquecerIcones, atualizarEstatisticas]
  );

  const apagar = useCallback(async () => {
    await apagarDadosOffline(queryClient);
    setUltimaSincronizacao(null);
    await atualizarEstatisticas();
  }, [queryClient, atualizarEstatisticas]);

  // Sincroniza ao abrir (depois de restaurar o cache) e sempre que a internet volta.
  useEffect(() => {
    if (restaurando || !online || !session) return;
    void sincronizarAgora().catch((erro) => console.warn('Falha ao sincronizar para uso offline', erro));
  }, [restaurando, online, session, sincronizarAgora]);

  // Voltou pro app depois de um tempo: confere se tem novidade.
  useEffect(() => {
    function aoVoltar() {
      if (document.visibilityState !== 'visible' || !navigator.onLine) return;
      const passou = ultimaSincronizacao ? Date.now() - ultimaSincronizacao.getTime() : Infinity;
      if (passou > REVALIDAR_APOS_MS) void sincronizarAgora().catch(() => undefined);
    }
    document.addEventListener('visibilitychange', aoVoltar);
    return () => document.removeEventListener('visibilitychange', aoVoltar);
  }, [ultimaSincronizacao, sincronizarAgora]);

  // Anexo novo (ou trocado) depois da sincronização: baixa só o arquivo.
  useEffect(() => {
    if (!online) return;
    let espera: ReturnType<typeof setTimeout> | undefined;
    const cancelar = queryClient.getQueryCache().subscribe((evento) => {
      const nome = evento.query.queryKey[0];
      if (evento.type !== 'updated' || evento.action.type !== 'success' || typeof nome !== 'string' || !CONSULTAS_DE_ANEXOS.has(nome)) return;
      clearTimeout(espera);
      espera = setTimeout(() => {
        void sincronizarArquivos(desejadosNoCache(), baixarDoStorage).then(atualizarEstatisticas).catch(() => undefined);
      }, ESPERA_ARQUIVO_NOVO_MS);
    });
    return () => {
      clearTimeout(espera);
      cancelar();
    };
  }, [online, queryClient, desejadosNoCache, atualizarEstatisticas]);

  // Pede ao navegador pra não apagar os dados guardados quando faltar espaço; e confere os arquivos já guardados.
  useEffect(() => {
    void estatisticasArquivos().then(setArquivos);
    const armazenamento = navigator.storage;
    if (!armazenamento?.persist) return;
    void armazenamento
      .persist()
      .then(() => armazenamento.persisted())
      .then(setArmazenamentoProtegido)
      .catch(() => undefined);
  }, []);

  const valor = useMemo<EstadoOffline>(
    () => ({ online, sincronizando, ultimaSincronizacao, arquivos, armazenamentoProtegido, sincronizarAgora, apagarDadosOffline: apagar }),
    [online, sincronizando, ultimaSincronizacao, arquivos, armazenamentoProtegido, sincronizarAgora, apagar]
  );

  return (
    <OfflineContext.Provider value={valor}>
      {children}
      {aquecendo && <AquecimentoOffline onTerminou={aoTerminarAquecimento} />}
    </OfflineContext.Provider>
  );
}

export function useOffline(): EstadoOffline {
  const ctx = useContext(OfflineContext);
  if (!ctx) throw new Error('useOffline precisa estar dentro de <OfflineProvider>');
  return ctx;
}
