import { useState, type ReactNode } from 'react';
import { obterUrlAssinada } from '../lib/storage';
import { useToast } from './Toast';
import { mensagemDeErro } from '../lib/erros';

export function ArquivoLink({
  bucket,
  caminho,
  expiraEmSegundos,
  children,
}: {
  bucket: string;
  caminho: string;
  /** Duração da URL assinada, em segundos. Padrão 3600 — usar um valor menor para conteúdo mais sensível. */
  expiraEmSegundos?: number;
  children: ReactNode;
}) {
  const { mostrarToast } = useToast();
  const [abrindo, setAbrindo] = useState(false);

  async function abrir() {
    setAbrindo(true);
    try {
      const url = await obterUrlAssinada(bucket, caminho, expiraEmSegundos);
      window.open(url, '_blank', 'noopener,noreferrer');
    } catch (err) {
      mostrarToast(mensagemDeErro(err), 'erro');
    } finally {
      setAbrindo(false);
    }
  }

  return (
    <button type="button" className="arquivo-link" onClick={abrir} disabled={abrindo}>
      {children}
    </button>
  );
}

/** Baixa um arquivo de bucket privado (busca a URL assinada e força o download, em vez de abrir em nova aba). */
export function BotaoBaixarArquivo({
  bucket,
  caminho,
  nomeArquivo,
  expiraEmSegundos,
}: {
  bucket: string;
  caminho: string;
  nomeArquivo: string;
  expiraEmSegundos?: number;
}) {
  const { mostrarToast } = useToast();
  const [baixando, setBaixando] = useState(false);

  async function baixar() {
    setBaixando(true);
    try {
      const url = await obterUrlAssinada(bucket, caminho, expiraEmSegundos);
      const resposta = await fetch(url);
      if (!resposta.ok) throw new Error('Não foi possível baixar o arquivo.');
      const blob = await resposta.blob();
      const urlBlob = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = urlBlob;
      link.download = nomeArquivo;
      link.click();
      URL.revokeObjectURL(urlBlob);
    } catch (err) {
      mostrarToast(mensagemDeErro(err), 'erro');
    } finally {
      setBaixando(false);
    }
  }

  return (
    <button type="button" className="arquivo-link" onClick={baixar} disabled={baixando}>
      Baixar
    </button>
  );
}
