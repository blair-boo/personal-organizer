import { Outlet } from 'react-router-dom';
import { AuthProvider } from './auth/AuthContext';
import { RequireAuth } from './components/RequireAuth';
import { GuardaDePermissao } from './components/GuardaDePermissao';
import { Layout } from './components/Layout';
import { OfflineProvider } from './components/OfflineContext';
import { ToastProvider } from './components/Toast';

export function RootLayout() {
  return (
    <AuthProvider>
      <RequireAuth>
        <ToastProvider>
          <OfflineProvider>
            <Layout>
              <GuardaDePermissao>
                <Outlet />
              </GuardaDePermissao>
            </Layout>
          </OfflineProvider>
        </ToastProvider>
      </RequireAuth>
    </AuthProvider>
  );
}
