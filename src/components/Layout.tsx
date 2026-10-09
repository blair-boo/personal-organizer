import type { ReactNode } from 'react';
import { useAuth } from '../auth/AuthContext';
import { useTema, type TemaPref } from '../hooks/useTema';
import { APP_NAME } from '../config';
import { DialogosProvider } from './Dialogo';
import { AbasEdicaoProvider, useAbasEdicaoOpcional } from './AbasEdicao';
import { IconeLua, IconeMonitor, IconeSol } from './IconesProvisorios';
import { NavAbas } from './NavAbas';
import { useOffline } from './OfflineContext';
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

function formatarHora(data: Date): string {
  return data.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
}

/** Ponto de conexão e hora da última atualização dos dados; clicar atualiza (e guarda tudo para uso offline). */
function IndicadorConexao() {
  const { online, sincronizando, ultimaSincronizacao, sincronizarAgora } = useOffline();
  const texto = sincronizando
    ? 'Atualizando…'
    : !online
      ? ultimaSincronizacao
        ? `Sem conexão · dados de ${formatarHora(ultimaSincronizacao)}`
        : 'Sem conexão'
      : ultimaSincronizacao
        ? `Atualizado às ${formatarHora(ultimaSincronizacao)}`
        : 'Atualizar';
  return (
    <button
      type="button"
      className="indicador-conexao"
      onClick={() => void sincronizarAgora()}
      disabled={sincronizando || !online}
      title="Atualizar os dados e guardar os arquivos para uso sem internet"
      aria-label={`${texto}. Atualizar os dados e guardar os arquivos para uso sem internet`}
    >
      <span className={`conexao-ponto ${online ? 'conexao-online' : 'conexao-offline'}`} aria-hidden="true" />
      <span>{texto}</span>
    </button>
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
          <IndicadorConexao />
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
