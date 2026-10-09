import { useState } from 'react';
import { useDialogos } from '../../components/Dialogo';
import { useOffline } from '../../components/OfflineContext';
import { useToast } from '../../components/Toast';
import { formatarBytes } from '../../lib/backup';
import { verificarAtualizacaoApp } from '../../lib/atualizacaoApp';
import { limparCachesApp } from '../../lib/cacheApp';
import { mensagemDeErro } from '../../lib/erros';

function formatarDataHora(data: Date): string {
  return data.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

/**
 * Settings > App: versão e atualização do app, esvaziar o cache e os dados
 * guardados no aparelho pra uso offline (Apartamento e Documentos).
 */
export function AppPage() {
  const { confirmar } = useDialogos();
  const { mostrarToast } = useToast();
  const { online, sincronizando, ultimaSincronizacao, arquivos, armazenamentoProtegido, sincronizarAgora, apagarDadosOffline } = useOffline();
  const [verificando, setVerificando] = useState(false);
  const [ocupado, setOcupado] = useState(false);

  async function verificarAtualizacao() {
    if (!online) {
      mostrarToast('Sem conexão: não dá para verificar atualização agora.', 'erro');
      return;
    }
    setVerificando(true);
    try {
      const resultado = await verificarAtualizacaoApp();
      if (resultado === 'atual') mostrarToast('O app já está na versão mais recente.');
      else if (resultado === 'indisponivel') mostrarToast('Este navegador não usa atualização automática do app.', 'info');
      // 'atualizando': a página recarrega sozinha
    } catch (erro) {
      mostrarToast(mensagemDeErro(erro), 'erro');
    } finally {
      setVerificando(false);
    }
  }

  async function sincronizar(recarregarTudo: boolean) {
    if (!online) {
      mostrarToast('Sem conexão: não dá para sincronizar agora.', 'erro');
      return;
    }
    if (recarregarTudo) {
      const ok = await confirmar({
        titulo: 'Recarregar tudo',
        mensagem: 'Isso apaga os arquivos guardados no aparelho e baixa tudo de novo do servidor, dados e arquivos. Pode levar alguns minutos e precisa de internet até terminar.',
        confirmarRotulo: 'Recarregar tudo',
        perigoso: true,
      });
      if (!ok) return;
    }
    setOcupado(true);
    try {
      await sincronizarAgora({ recarregarTudo });
      mostrarToast(recarregarTudo ? 'Tudo recarregado.' : 'Sincronizado.');
    } catch (erro) {
      mostrarToast(mensagemDeErro(erro), 'erro');
    } finally {
      setOcupado(false);
    }
  }

  async function apagarOffline() {
    const ok = await confirmar({
      titulo: 'Apagar dados offline',
      mensagem: 'Isso apaga do aparelho os dados e arquivos guardados para uso sem internet. Nada é apagado do servidor. Eles voltam a ser guardados na próxima sincronização.',
      confirmarRotulo: 'Apagar',
      perigoso: true,
    });
    if (!ok) return;
    setOcupado(true);
    try {
      await apagarDadosOffline();
      mostrarToast('Dados offline apagados deste aparelho.');
    } catch (erro) {
      mostrarToast(mensagemDeErro(erro), 'erro');
    } finally {
      setOcupado(false);
    }
  }

  async function esvaziarCache() {
    // Sem internet não dá para o app se baixar de novo depois: ficaria sem abrir.
    if (!online) {
      mostrarToast('Sem conexão: o cache não foi esvaziado, para o app continuar abrindo.', 'erro');
      return;
    }
    const ok = await confirmar({
      titulo: 'Esvaziar cache',
      mensagem: 'Isso apaga os arquivos do app guardados no aparelho e recarrega a página. O app baixa tudo de novo (precisa de internet). Os dados e arquivos para uso offline não são apagados.',
      confirmarRotulo: 'Esvaziar cache',
      perigoso: true,
    });
    if (!ok) return;
    setOcupado(true);
    try {
      await limparCachesApp();
      window.location.reload();
    } catch (erro) {
      mostrarToast(mensagemDeErro(erro), 'erro');
      setOcupado(false);
    }
  }

  const desabilitado = ocupado || sincronizando;

  return (
    <div className="settings-secao">
      <h2>App</h2>
      <p className="settings-secao-ajuda">Versão do app e dados guardados no aparelho para uso sem internet.</p>

      <section>
        <h3>Atualização</h3>
        <p className="backup-nota">Versão carregada: build de {formatarDataHora(new Date(__BUILD_ISO__))}.</p>
        <button type="button" onClick={() => void verificarAtualizacao()} disabled={verificando || !online}>
          {verificando ? 'Verificando…' : 'Verificar atualização'}
        </button>
      </section>

      <section>
        <h3>Uso offline</h3>
        <p className="backup-nota">
          Apartamento e Documentos ficam guardados no aparelho e abrem sem internet, anexos incluídos. Finanças precisa de internet.
        </p>
        <ul className="lista-contas">
          <li>
            <span>Última sincronização</span>
            <span className="backup-item-info">{ultimaSincronizacao ? formatarDataHora(ultimaSincronizacao) : 'Ainda não sincronizou'}</span>
          </li>
          <li>
            <span>Arquivos guardados</span>
            <span className="backup-item-info">
              {arquivos.arquivos.toLocaleString('pt-BR')} ({formatarBytes(arquivos.bytes)})
            </span>
          </li>
          <li>
            <span>Armazenamento protegido contra limpeza</span>
            <span className="backup-item-info">{armazenamentoProtegido === null ? 'Não informado pelo navegador' : armazenamentoProtegido ? 'Sim' : 'Não'}</span>
          </li>
        </ul>
        <div className="modal-acoes">
          <button type="button" onClick={() => void sincronizar(false)} disabled={desabilitado || !online}>
            {sincronizando ? 'Sincronizando…' : 'Sincronizar agora'}
          </button>
          <button type="button" onClick={() => void sincronizar(true)} disabled={desabilitado || !online}>
            Recarregar tudo
          </button>
          <button type="button" className="botao-perigoso" onClick={() => void apagarOffline()} disabled={desabilitado}>
            Apagar dados offline
          </button>
        </div>
      </section>

      <section>
        <h3>Cache do app</h3>
        <p className="backup-nota">Se o app estiver se comportando de um jeito estranho ou preso numa versão antiga.</p>
        <button type="button" className="botao-perigoso" onClick={() => void esvaziarCache()} disabled={desabilitado || !online}>
          Esvaziar cache
        </button>
      </section>
    </div>
  );
}
