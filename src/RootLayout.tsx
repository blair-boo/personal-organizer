import { Outlet } from 'react-router-dom';
import { AuthProvider } from './auth/AuthContext';
import { RequireAuth } from './components/RequireAuth';
import { Layout } from './components/Layout';
import { ToastProvider } from './components/Toast';

export function RootLayout() {
  return (
    <AuthProvider>
      <RequireAuth>
        <ToastProvider>
          <Layout>
            <Outlet />
          </Layout>
        </ToastProvider>
      </RequireAuth>
    </AuthProvider>
  );
}
