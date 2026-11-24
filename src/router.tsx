import { lazy, Suspense } from 'react';
import { createBrowserRouter, Navigate, useLocation } from 'react-router-dom';
import { RootLayout } from './RootLayout';
import { competenciaAtual } from './lib/datas';

import { FinancasLayout } from './pages/financas/FinancasLayout';
import { ContaCorrentePage } from './pages/financas/ContaCorrentePage';
import { CartaoCreditoPage } from './pages/financas/CartaoCreditoPage';
import { ResumoMesPage } from './pages/financas/ResumoMesPage';
import { ParcelamentosPage } from './pages/financas/ParcelamentosPage';

// Carregada sob demanda: só essa página usa recharts, uma lib pesada que não
// vale a pena colocar no bundle principal pra quem só usa o resto do app.
const ResumoGeralPage = lazy(() =>
  import('./pages/financas/ResumoGeralPage').then((m) => ({ default: m.ResumoGeralPage }))
);

import { ApartamentoLayout } from './pages/apartamento/ApartamentoLayout';
import { ItensPage } from './pages/apartamento/ItensPage';
import { ProjetosPage } from './pages/apartamento/ProjetosPage';
import { ManutencaoPage } from './pages/apartamento/ManutencaoPage';

import { StoragePage } from './pages/storage/StoragePage';

import { DocumentosLayout } from './pages/documentos/DocumentosLayout';
import { DocumentosPessoaisPage } from './pages/documentos/DocumentosPessoaisPage';
import { DocumentosAreaPage } from './pages/documentos/DocumentosAreaPage';
import { HojePage } from './pages/hoje/HojePage';
import { GatosPage } from './pages/documentos/GatosPage';

import { SettingsLayout } from './pages/settings/SettingsLayout';
import { CategoriasPage } from './pages/settings/CategoriasPage';
import { ContasPage } from './pages/settings/ContasPage';
import { BancoDeLancamentosPage } from './pages/settings/BancoDeLancamentosPage';
import { CalendarioPage } from './pages/settings/CalendarioPage';
import { IconesPage } from './pages/settings/IconesPage';
import { BackupPage } from './pages/settings/BackupPage';
import { AppPage } from './pages/settings/AppPage';

function RedirecionarParaTarefas() {
  const { search } = useLocation();
  return <Navigate to={`/apartamento/tarefas${search}`} replace />;
}

export const router = createBrowserRouter(
  [
    {
      path: '/',
      element: <RootLayout />,
      children: [
        { index: true, element: <Navigate to="/hoje" replace /> },
        { path: 'hoje', element: <HojePage /> },
        {
          path: 'financas',
          children: [
            { index: true, element: <Navigate to={`/financas/${competenciaAtual()}/resumo`} replace /> },
            {
              path: ':competencia',
              element: <FinancasLayout />,
              children: [
                { index: true, element: <ResumoMesPage /> },
                { path: 'conta-corrente', element: <ContaCorrentePage /> },
                { path: 'cartao-credito', element: <CartaoCreditoPage /> },
                { path: 'resumo', element: <ResumoMesPage /> },
              ],
            },
            {
              path: 'resumo-geral',
              element: (
                <Suspense fallback={<p>Carregando…</p>}>
                  <ResumoGeralPage />
                </Suspense>
              ),
            },
            { path: 'parcelamentos', element: <ParcelamentosPage /> },
          ],
        },
        {
          path: 'apartamento',
          element: <ApartamentoLayout />,
          children: [
            { index: true, element: <Navigate to="/apartamento/itens" replace /> },
            { path: 'itens', element: <ItensPage /> },
            { path: 'projetos', element: <ProjetosPage /> },
            { path: 'tarefas', element: <ManutencaoPage /> },
            // Rota antiga (favoritos e atalhos salvos): leva para Tarefas mantendo os filtros da URL.
            { path: 'manutencao', element: <RedirecionarParaTarefas /> },
          ],
        },
        { path: 'storage', element: <StoragePage /> },
        {
          path: 'documentos',
          element: <DocumentosLayout />,
          children: [
            { index: true, element: <Navigate to="/documentos/pessoais" replace /> },
            { path: 'pessoais', element: <DocumentosPessoaisPage /> },
            { path: 'gatos', element: <GatosPage /> },
            { path: 'apartamento', element: <DocumentosAreaPage area="apartamento" /> },
            { path: 'arquivo', element: <DocumentosAreaPage area="arquivo" /> },
            { path: 'outros', element: <DocumentosAreaPage area="outros" /> },
          ],
        },
        {
          path: 'settings',
          element: <SettingsLayout />,
          children: [
            { index: true, element: <Navigate to="/settings/categorias" replace /> },
            { path: 'categorias', element: <CategoriasPage /> },
            { path: 'icones', element: <IconesPage /> },
            { path: 'contas', element: <ContasPage /> },
            { path: 'banco-lancamentos', element: <BancoDeLancamentosPage /> },
            { path: 'calendario', element: <CalendarioPage /> },
            { path: 'backup', element: <BackupPage /> },
            { path: 'app', element: <AppPage /> },
          ],
        },
        { path: '*', element: <Navigate to="/" replace /> },
      ],
    },
  ],
  { basename: import.meta.env.BASE_URL }
);
