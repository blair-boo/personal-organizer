import { useEffect, useRef, useState } from 'react';
import { useDialogos } from '../../components/Dialogo';
import { useToast } from '../../components/Toast';
import { mensagemDeErro } from '../../lib/erros';
import { obterUrlParaAbrir } from '../../lib/offline/abrirArquivo';
import { useDefinirFotoGato } from '../../hooks/useGatos';
import type { Gato } from '../../types';

/** Foto do gato (bucket confidencial; aparece também sem internet, pela cópia guardada no aparelho). */
export function FotoGato({ gato }: { gato: Gato }) {
  const { mostrarToast } = useToast();
  const { confirmar } = useDialogos();
  const definirFoto = useDefinirFotoGato();
  const campoArquivo = useRef<HTMLInputElement>(null);
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    let ativo = true;
    if (!gato.foto_url) return;
    obterUrlParaAbrir('confidencial', gato.foto_url)
      .then((u) => ativo && setUrl(u))
      .catch(() => ativo && setUrl(null));
    return () => {
      ativo = false;
    };
  }, [gato.foto_url]);

  const urlDaFoto = gato.foto_url ? url : null;

  async function trocar(arquivo: File | undefined) {
    if (!arquivo) return;
    if (!arquivo.type.startsWith('image/')) {
      mostrarToast('Escolha um arquivo de imagem.', 'erro');
      return;
    }
    try {
      await definirFoto.mutateAsync({ gato, arquivo });
      mostrarToast('Foto salva.');
    } catch (err) {
      mostrarToast(mensagemDeErro(err), 'erro');
    }
  }

  async function remover() {
    const ok = await confirmar({ titulo: 'Remover a foto?', mensagem: `A foto de ${gato.nome} será apagada.`, confirmarRotulo: 'Remover', perigoso: true });
    if (!ok) return;
    try {
      await definirFoto.mutateAsync({ gato, arquivo: null });
      mostrarToast('Foto removida.');
    } catch (err) {
      mostrarToast(mensagemDeErro(err), 'erro');
    }
  }

  return (
    <div className="gatos-foto">
      {urlDaFoto ? (
        <img className="gatos-foto-imagem" src={urlDaFoto} alt={`Foto de ${gato.nome}`} />
      ) : (
        <div className="gatos-foto-imagem gatos-foto-vazia">{gato.foto_url ? 'Foto indisponível agora' : 'Sem foto'}</div>
      )}
      <div className="hierarquia-item-acoes">
        <input ref={campoArquivo} type="file" accept="image/*" hidden onChange={(e) => { void trocar(e.target.files?.[0]); e.target.value = ''; }} />
        <button type="button" onClick={() => campoArquivo.current?.click()} disabled={definirFoto.isPending}>
          {definirFoto.isPending ? 'Enviando…' : gato.foto_url ? 'Trocar foto' : 'Adicionar foto'}
        </button>
        {gato.foto_url && (
          <button type="button" onClick={() => void remover()} disabled={definirFoto.isPending}>
            Remover foto
          </button>
        )}
      </div>
    </div>
  );
}
