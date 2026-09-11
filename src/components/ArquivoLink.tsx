import { useState, type ReactNode } from 'react';
import { obterUrlAssinada } from '../lib/storage';
import { useToast } from './Toast';
import { mensagemDeErro } from '../lib/erros';

export function ArquivoLink({ bucket, caminho, children }: { bucket: string; caminho: string; children: ReactNode }) {
  const { mostrarToast } = useToast();
  const [abrindo, setAbrindo] = useState(false);

  async function abrir() {
    setAbrindo(true);
    try {
      const url = await obterUrlAssinada(bucket, caminho);
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
