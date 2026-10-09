import { Outlet } from 'react-router-dom';
import { AuthProvider } from './auth/AuthContext';
import { RequireAuth } from './components/RequireAuth';
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
              <Outlet />
            </Layout>
          </OfflineProvider>
        </ToastProvider>
      </RequireAuth>
    </AuthProvider>
  );
}
