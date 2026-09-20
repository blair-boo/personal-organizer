import { lazy, Suspense } from 'react';
import { createBrowserRouter, Navigate } from 'react-router-dom';
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

import { DocumentosLayout } from './pages/documentos/DocumentosLayout';
import { DocumentosPessoaisPage } from './pages/documentos/DocumentosPessoaisPage';
import { DocumentosAreaPage } from './pages/documentos/DocumentosAreaPage';

import { SettingsLayout } from './pages/settings/SettingsLayout';
import { CategoriasPage } from './pages/settings/CategoriasPage';
import { TagsItensPage } from './pages/settings/TagsItensPage';
import { ContasPage } from './pages/settings/ContasPage';
import { BancoDeLancamentosPage } from './pages/settings/BancoDeLancamentosPage';
import { ClassificacoesTarefasPage } from './pages/settings/ClassificacoesTarefasPage';
import { CalendarioPage } from './pages/settings/CalendarioPage';
import { TestesPage } from './pages/settings/TestesPage';

export const router = createBrowserRouter(
  [
    {
      path: '/',
      element: <RootLayout />,
      children: [
        { index: true, element: <Navigate to="/financas" replace /> },
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
            { path: 'manutencao', element: <ManutencaoPage /> },
          ],
        },
        {
          path: 'documentos',
          element: <DocumentosLayout />,
          children: [
            { index: true, element: <Navigate to="/documentos/pessoais" replace /> },
            { path: 'pessoais', element: <DocumentosPessoaisPage /> },
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
            { path: 'tags-itens', element: <TagsItensPage /> },
            { path: 'contas', element: <ContasPage /> },
            { path: 'banco-lancamentos', element: <BancoDeLancamentosPage /> },
            { path: 'classificacoes-tarefas', element: <ClassificacoesTarefasPage /> },
            { path: 'calendario', element: <CalendarioPage /> },
            { path: 'testes', element: <TestesPage /> },
          ],
        },
        { path: '*', element: <Navigate to="/" replace /> },
      ],
    },
  ],
  { basename: import.meta.env.BASE_URL }
);
