import type { ReactNode } from 'react';
import { NavLink } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { useTema, type TemaPref } from '../hooks/useTema';
import { APP_NAME } from '../config';
import { DialogosProvider } from './Dialogo';

const TEMA_INFO: Record<TemaPref, { icone: string; titulo: string }> = {
  light: { icone: '☀️', titulo: 'Tema: claro (clique para escuro)' },
  dark: { icone: '🌙', titulo: 'Tema: escuro (clique para sistema)' },
  system: { icone: '🖥️', titulo: 'Tema: sistema (clique para claro)' },
};

export function Layout({ children }: { children: ReactNode }) {
  const { signOut } = useAuth();
  const { tema, ciclarTema } = useTema();

  return (
    <DialogosProvider>
      <div className="app-layout">
        <header className="app-header">
          <div className="app-header-top">
            <h1 className="app-title">{APP_NAME}</h1>
            <button
              type="button"
              onClick={ciclarTema}
              className="tema-toggle"
              title={TEMA_INFO[tema].titulo}
              aria-label={TEMA_INFO[tema].titulo}
            >
              {TEMA_INFO[tema].icone}
            </button>
            <button type="button" onClick={signOut} className="logout-button">
              Sair
            </button>
          </div>
          <nav className="app-nav">
            <NavLink to="/financas">Finanças</NavLink>
            <NavLink to="/apartamento">Apartamento</NavLink>
            <NavLink to="/documentos">Documentos</NavLink>
            <NavLink to="/settings">Settings</NavLink>
          </nav>
        </header>
        <main className="app-main">{children}</main>
      </div>
    </DialogosProvider>
  );
}
