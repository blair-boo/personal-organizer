import { useEffect, useRef, useState } from 'react';
import { RecorteFotoModal } from '../../components/RecorteFotoModal';
import { useDialogos } from '../../components/Dialogo';
import { useToast } from '../../components/Toast';
import { mensagemDeErro } from '../../lib/erros';
import { hojeIso } from '../../lib/datas';
import { idadeDoGato } from '../../lib/gatos';
import { obterUrlParaAbrir } from '../../lib/offline/abrirArquivo';
import { useDefinirFotoGato } from '../../hooks/useGatos';
import type { Gato } from '../../types';

/**
 * Cabeçalho da ficha: foto em círculo, nome do gato e idade (se há nascimento). Clicar na foto abre
 * "Trocar foto" e "Remover foto"; sem foto, clicar abre a escolha do arquivo. A foto escolhida passa
 * pelo recorte antes de subir. Bucket confidencial; a foto aparece também sem internet, pela cópia guardada no aparelho.
 */
export function FotoGato({ gato }: { gato: Gato }) {
  const { mostrarToast } = useToast();
  const { confirmar } = useDialogos();
  const definirFoto = useDefinirFotoGato();
  const campoArquivo = useRef<HTMLInputElement>(null);
  const [url, setUrl] = useState<string | null>(null);
  const [menuAberto, setMenuAberto] = useState(false);
  const [paraRecortar, setParaRecortar] = useState<File | null>(null);
  const idade = idadeDoGato(gato.nascimento, hojeIso());

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

  function aoEscolherArquivo(arquivo: File | undefined) {
    if (!arquivo) return;
    if (!arquivo.type.startsWith('image/')) {
      mostrarToast('Escolha um arquivo de imagem.', 'erro');
      return;
    }
    setParaRecortar(arquivo);
  }

  async function salvarRecortada(recortada: File) {
    setParaRecortar(null);
    try {
      const resultado = await definirFoto.mutateAsync({ gato, arquivo: recortada });
      mostrarToast(resultado === 'enfileirada' ? 'Foto salva. Será enviada quando houver internet.' : 'Foto salva.');
    } catch (err) {
      mostrarToast(mensagemDeErro(err), 'erro');
    }
  }

  async function remover() {
    setMenuAberto(false);
    const ok = await confirmar({ titulo: 'Remover a foto?', mensagem: `A foto de ${gato.nome} será apagada.`, confirmarRotulo: 'Remover', perigoso: true });
    if (!ok) return;
    try {
      await definirFoto.mutateAsync({ gato, arquivo: null });
      mostrarToast('Foto removida.');
    } catch (err) {
      mostrarToast(mensagemDeErro(err), 'erro');
    }
  }

  function aoClicarNaFoto() {
    if (gato.foto_url) setMenuAberto((v) => !v);
    else campoArquivo.current?.click();
  }

  const rotuloFoto = gato.foto_url ? `Foto de ${gato.nome}: trocar ou remover` : `Adicionar foto de ${gato.nome}`;

  return (
    <div className="gatos-foto">
      <div className="gatos-foto-menu-area">
        <button type="button" className="gatos-foto-botao" onClick={aoClicarNaFoto} disabled={definirFoto.isPending} title={rotuloFoto} aria-label={rotuloFoto} aria-haspopup={gato.foto_url ? 'menu' : undefined} aria-expanded={gato.foto_url ? menuAberto : undefined}>
          {urlDaFoto ? (
            <img className="gatos-foto-imagem" src={urlDaFoto} alt="" />
          ) : (
            <span className="gatos-foto-imagem gatos-foto-vazia">{definirFoto.isPending ? 'Enviando…' : gato.foto_url ? 'Foto indisponível agora' : 'Adicionar foto'}</span>
          )}
        </button>
        {menuAberto && (
          <div className="gatos-foto-menu" role="menu">
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                setMenuAberto(false);
                campoArquivo.current?.click();
              }}
            >
              Trocar foto
            </button>
            <button type="button" role="menuitem" onClick={() => void remover()}>
              Remover foto
            </button>
          </div>
        )}
        <input
          ref={campoArquivo}
          type="file"
          accept="image/*"
          hidden
          onChange={(e) => {
            aoEscolherArquivo(e.target.files?.[0]);
            e.target.value = '';
          }}
        />
      </div>
      <div className="gatos-foto-titulo">
        <h3 className="gatos-foto-nome">{gato.nome}</h3>
        {idade && <p className="gatos-idade">{idade}</p>}
      </div>
      {paraRecortar && <RecorteFotoModal arquivo={paraRecortar} rotulo={gato.nome} onConfirmar={(f) => void salvarRecortada(f)} onCancelar={() => setParaRecortar(null)} />}
    </div>
  );
}
