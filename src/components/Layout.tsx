import type { ReactNode } from 'react';
import { useAuth } from '../auth/AuthContext';
import { useTema, type TemaPref } from '../hooks/useTema';
import { APP_NAME } from '../config';
import { DialogosProvider } from './Dialogo';
import { AbasEdicaoProvider, useAbasEdicaoOpcional } from './AbasEdicao';
import { IconeFuncao } from './IconeUso';
import { IconeLua, IconeMonitor, IconeSol } from './IconesProvisorios';
import { NavAbas } from './NavAbas';
import { PainelEdicaoAbas } from './PainelEdicaoAbas';

const TEMA_INFO: Record<TemaPref, { titulo: string }> = {
  light: { titulo: 'Tema: claro (clique para escuro)' },
  dark: { titulo: 'Tema: escuro (clique para sistema)' },
  system: { titulo: 'Tema: sistema (clique para claro)' },
};

const ROTA_PRINCIPAL: Record<string, string> = {
  'principal:financas': '/financas',
  'principal:apartamento': '/apartamento',
  'principal:documentos': '/documentos',
  'principal:settings': '/settings',
};

export function Layout({ children }: { children: ReactNode }) {
  return (
    <DialogosProvider>
      <AbasEdicaoProvider>
        <LayoutInterno>{children}</LayoutInterno>
      </AbasEdicaoProvider>
    </DialogosProvider>
  );
}

function LayoutInterno({ children }: { children: ReactNode }) {
  const { signOut } = useAuth();
  const { tema, ciclarTema } = useTema();
  const edicao = useAbasEdicaoOpcional();
  const editando = edicao?.editando ?? false;

  return (
    <div className="app-layout">
      <header className="app-header">
        <div className="app-header-top">
          <h1 className="app-title">{APP_NAME}</h1>
          {editando && edicao && (
            <>
              <button
                type="button"
                className="btn-icone icone-uso-botao"
                onClick={() => void edicao.cancelar()}
                disabled={edicao.salvando}
                title="Sair do modo de edição e cancelar alterações"
                aria-label="Sair do modo de edição e cancelar alterações"
              >
                <IconeFuncao funcao="fechar" />
              </button>
              <button
                type="button"
                className="btn-icone icone-uso-botao"
                onClick={() => void edicao.salvar()}
                disabled={edicao.salvando}
                title="Salvar alterações das abas"
                aria-label="Salvar alterações das abas"
              >
                <IconeFuncao funcao="salvar" />
              </button>
            </>
          )}
          <button type="button" onClick={ciclarTema} className="tema-toggle" title={TEMA_INFO[tema].titulo} aria-label={TEMA_INFO[tema].titulo}>
            {tema === 'light' ? <IconeSol /> : tema === 'dark' ? <IconeLua /> : <IconeMonitor />}
          </button>
          <button type="button" onClick={signOut} className="logout-button">
            Sair
          </button>
        </div>
        <NavAbas grupo="principal" className="app-nav" rota={(chave) => ROTA_PRINCIPAL[chave]} />
        {editando && <PainelEdicaoAbas />}
      </header>
      <main className="app-main">{children}</main>
    </div>
  );
}
