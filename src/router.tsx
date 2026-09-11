import { createBrowserRouter, Navigate } from 'react-router-dom';
import { RootLayout } from './RootLayout';
import { competenciaAtual } from './lib/datas';

import { FinancasLayout } from './pages/financas/FinancasLayout';
import { ContaCorrentePage } from './pages/financas/ContaCorrentePage';
import { CartaoCreditoPage } from './pages/financas/CartaoCreditoPage';
import { ResumoMesPage } from './pages/financas/ResumoMesPage';
import { ResumoGeralPage } from './pages/financas/ResumoGeralPage';
import { ParcelamentosPage } from './pages/financas/ParcelamentosPage';

import { ApartamentoLayout } from './pages/apartamento/ApartamentoLayout';
import { ItensPage } from './pages/apartamento/ItensPage';
import { ProjetosPage } from './pages/apartamento/ProjetosPage';
import { ManutencaoPage } from './pages/apartamento/ManutencaoPage';

import { SettingsLayout } from './pages/settings/SettingsLayout';
import { CategoriasPage } from './pages/settings/CategoriasPage';
import { CategoriasItensPage } from './pages/settings/CategoriasItensPage';
import { ContasPage } from './pages/settings/ContasPage';
import { BancoDeLancamentosPage } from './pages/settings/BancoDeLancamentosPage';
import { ClassificacoesManutencaoPage } from './pages/settings/ClassificacoesManutencaoPage';

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
            { path: 'resumo-geral', element: <ResumoGeralPage /> },
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
          path: 'settings',
          element: <SettingsLayout />,
          children: [
            { index: true, element: <Navigate to="/settings/categorias" replace /> },
            { path: 'categorias', element: <CategoriasPage /> },
            { path: 'categorias-itens', element: <CategoriasItensPage /> },
            { path: 'contas', element: <ContasPage /> },
            { path: 'banco-lancamentos', element: <BancoDeLancamentosPage /> },
            { path: 'classificacoes-manutencao', element: <ClassificacoesManutencaoPage /> },
          ],
        },
        { path: '*', element: <Navigate to="/" replace /> },
      ],
    },
  ],
  { basename: import.meta.env.BASE_URL }
);
