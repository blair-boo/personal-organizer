import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { RouterProvider } from 'react-router-dom';
import { QueryClient } from '@tanstack/react-query';
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client';
import './index.css';
import { router } from './router';
import { MENSAGEM_SEM_CONEXAO } from './lib/erros';
import { consultaFicaOffline, persisterOffline, VALIDADE_OFFLINE_MS, VERSAO_DO_CACHE } from './lib/offline/persistencia';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60_000,
      retry: 1,
      // Tem que ser >= à validade do que fica guardado no aparelho, senão o react-query descarta antes.
      gcTime: VALIDADE_OFFLINE_MS,
    },
    // Sem internet a ação é recusada na hora, com aviso em português, em vez de ficar pausada e rodar
    // sozinha quando a conexão voltar, ou esperar até ~30 s o supabase-js desistir de renovar o token.
    mutations: {
      networkMode: 'always',
      onMutate: () => {
        if (!navigator.onLine) throw new Error(MENSAGEM_SEM_CONEXAO);
      },
    },
  },
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <PersistQueryClientProvider
      client={queryClient}
      persistOptions={{
        persister: persisterOffline,
        maxAge: VALIDADE_OFFLINE_MS,
        buster: VERSAO_DO_CACHE,
        dehydrateOptions: { shouldDehydrateQuery: consultaFicaOffline },
      }}
    >
      <RouterProvider router={router} />
    </PersistQueryClientProvider>
  </StrictMode>
);
