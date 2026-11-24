import { useMemo, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { useTema, type TemaPref } from '../hooks/useTema';
import { useProximasDatasGatos } from '../hooks/useProximasDatasGatos';
import { contarVencidas } from '../lib/gatos';
import { useTarefasManutencao } from '../hooks/useTarefasManutencao';
import { hojeIso } from '../lib/datas';
import { contarFila, pedirEnvioDaFila, usePendentes } from '../lib/offline/fila';
import { tarefaAtrasada } from '../lib/historicoTarefa';
import { APP_NAME } from '../config';
import { DialogosProvider, useDialogos } from './Dialogo';
import { AbasEdicaoProvider, useAbasEdicaoOpcional } from './AbasEdicao';
import { IconeFuncao } from './IconeUso';
import { NavAbas } from './NavAbas';
import { useOffline } from './OfflineContext';
import { PainelEdicaoAbas } from './PainelEdicaoAbas';

const TEMA_INFO: Record<TemaPref, { titulo: string }> = {
  light: { titulo: 'Tema: claro (clique para escuro)' },
  dark: { titulo: 'Tema: escuro (clique para sistema)' },
  system: { titulo: 'Tema: sistema (clique para claro)' },
};

const ROTA_PRINCIPAL: Record<string, string> = {
  'principal:hoje': '/hoje',
  'principal:financas': '/financas',
  'principal:apartamento': '/apartamento',
  'principal:storage': '/storage',
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

/** Quantas tarefas de manutenção estão atrasadas; tocar leva à Manutenção já filtrada. Some quando não há nenhuma. */
function IndicadorAtrasadas() {
  const { data: tarefas } = useTarefasManutencao();
  const navigate = useNavigate();
  const quantidade = useMemo(() => {
    const hoje = hojeIso();
    return (tarefas ?? []).filter((t) => t.ativo && tarefaAtrasada(t, hoje)).length;
  }, [tarefas]);
  if (quantidade === 0) return null;
  const texto = quantidade === 1 ? '1 atrasada' : `${quantidade} atrasadas`;
  return (
    <button
      type="button"
      className="indicador-conexao"
      onClick={() => navigate('/apartamento/manutencao?filtro=atrasadas')}
      title={`${texto}: ver as tarefas de manutenção atrasadas`}
      aria-label={`${texto}: ver as tarefas de manutenção atrasadas`}
    >
      <span className="conexao-ponto conexao-offline" aria-hidden="true" />
      <span>{texto}</span>
    </button>
  );
}

/** Quantas vacinas e vermífugos dos gatos estão vencidos; tocar leva à aba Gatos. Some quando não há nenhum. */
function IndicadorGatosVencidos() {
  const proximas = useProximasDatasGatos();
  const navigate = useNavigate();
  const quantidade = contarVencidas(proximas);
  if (quantidade === 0) return null;
  const texto = quantidade === 1 ? '1 vencida (gatos)' : `${quantidade} vencidas (gatos)`;
  return (
    <button
      type="button"
      className="indicador-conexao"
      onClick={() => navigate('/documentos/gatos')}
      title={`${texto}: ver as vacinas e vermífugos dos gatos`}
      aria-label={`${texto}: ver as vacinas e vermífugos dos gatos`}
    >
      <span className="conexao-ponto conexao-offline" aria-hidden="true" />
      <span>{texto}</span>
    </button>
  );
}

/** Quantas alterações feitas sem internet esperam para ser enviadas; tocar tenta enviar. */
function IndicadorPendentes() {
  const pendentes = usePendentes();
  const { online } = useOffline();
  if (pendentes === 0) return null;
  const texto = pendentes === 1 ? '1 alteração pendente' : `${pendentes} alterações pendentes`;
  return (
    <button
      type="button"
      className="indicador-conexao"
      onClick={pedirEnvioDaFila}
      disabled={!online}
      title={online ? `${texto}: enviar agora` : `${texto}: serão enviadas quando houver internet`}
      aria-label={online ? `${texto}: enviar agora` : `${texto}: serão enviadas quando houver internet`}
    >
      <span className="conexao-ponto conexao-offline" aria-hidden="true" />
      <span>{texto}</span>
    </button>
  );
}

function LayoutInterno({ children }: { children: ReactNode }) {
  const { signOut } = useAuth();
  const { confirmar } = useDialogos();
  const { tema, ciclarTema } = useTema();
  const edicao = useAbasEdicaoOpcional();
  const editando = edicao?.editando ?? false;

  /** Sair apaga tudo do aparelho, inclusive o que ainda não foi enviado: pergunta antes. */
  async function sair() {
    const pendentes = await contarFila();
    if (pendentes > 0) {
      const ok = await confirmar({
        titulo: 'Há alterações sem enviar',
        mensagem: `${pendentes === 1 ? '1 alteração feita' : `${pendentes} alterações feitas`} sem internet ainda não ${pendentes === 1 ? 'foi enviada' : 'foram enviadas'}. Se você sair agora, ${pendentes === 1 ? 'ela será perdida' : 'elas serão perdidas'}.`,
        confirmarRotulo: 'Sair e perder',
        perigoso: true,
      });
      if (!ok) return;
    }
    await signOut();
  }

  return (
    <div className="app-layout">
      <header className="app-header">
        <div className="app-header-top">
          <h1 className="app-title">{APP_NAME}</h1>
          <IndicadorPendentes />
          <IndicadorAtrasadas />
          <IndicadorGatosVencidos />
          <IndicadorConexao />
          <button type="button" onClick={ciclarTema} className="tema-toggle" title={TEMA_INFO[tema].titulo} aria-label={TEMA_INFO[tema].titulo}>
            <IconeFuncao funcao={tema === 'light' ? 'tema_claro' : tema === 'dark' ? 'tema_escuro' : 'tema_sistema'} />
          </button>
          <button type="button" onClick={sair} className="logout-button">
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
