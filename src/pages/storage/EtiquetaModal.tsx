import { useEffect, useRef, useState } from 'react';
import { ModalBase } from '../../components/ModalBase';
import { useToast } from '../../components/Toast';
import { mensagemDeErro } from '../../lib/erros';
import { codigoDaCaixa } from '../../lib/caixas';
import { slugify } from '../../lib/storage';
import type { CaixaStorage } from '../../types';
import type { ImagemRgba, SimboloRmqr } from '../../lib/rmqr';

/** Pixels por módulo no PNG baixado (grande, pra imprimir sem borrar). */
const ESCALA_DOWNLOAD = 10;
/** Altura máxima da etiqueta da impressora, em mm (só pra mostrar o tamanho do módulo). */
const ALTURA_ETIQUETA_MM = 14;

function desenhar(canvas: HTMLCanvasElement, imagem: ImagemRgba) {
  canvas.width = imagem.width;
  canvas.height = imagem.height;
  canvas.getContext('2d')?.putImageData(new ImageData(new Uint8ClampedArray(imagem.data), imagem.width, imagem.height), 0, 0);
}

/** Mostra a etiqueta (rMQR com o código da caixa) e baixa o PNG pra imprimir. */
export function EtiquetaModal({ caixa, onFechar }: { caixa: CaixaStorage; onFechar: () => void }) {
  const { mostrarToast } = useToast();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [simbolo, setSimbolo] = useState<SimboloRmqr | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const codigo = codigoDaCaixa(caixa.numero);

  useEffect(() => {
    let ativo = true;
    void (async () => {
      try {
        const { gerarSimboloRmqr, renderizarSimbolo } = await import('../../lib/rmqr');
        const gerado = await gerarSimboloRmqr(codigo);
        if (!ativo) return;
        setSimbolo(gerado);
        if (canvasRef.current) desenhar(canvasRef.current, renderizarSimbolo(gerado, 6));
      } catch (err) {
        if (ativo) setErro(mensagemDeErro(err));
      }
    })();
    return () => {
      ativo = false;
    };
  }, [codigo]);

  async function baixar() {
    if (!simbolo) return;
    try {
      const { renderizarSimbolo } = await import('../../lib/rmqr');
      const canvas = document.createElement('canvas');
      desenhar(canvas, renderizarSimbolo(simbolo, ESCALA_DOWNLOAD));
      const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'));
      if (!blob) throw new Error('Não foi possível gerar a imagem.');
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `etiqueta-${slugify(codigo)}.png`;
      link.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      mostrarToast(mensagemDeErro(err), 'erro');
    }
  }

  const milimetrosPorModulo = simbolo ? ALTURA_ETIQUETA_MM / (simbolo.altura + 4) : null;

  return (
    <ModalBase aberto rotulo={`Etiqueta da caixa ${codigo}`} onFechar={onFechar} classe="modal-edicao modal-storage">
      <h3 className="modal-titulo">Etiqueta da caixa</h3>
      <p>
        <strong>{codigo}</strong> · {caixa.nome}
      </p>
      {erro ? (
        <p role="alert">{erro}</p>
      ) : !simbolo ? (
        <p>Carregando…</p>
      ) : null}
      <canvas ref={canvasRef} className="storage-etiqueta" aria-label={`Código ${codigo}`} hidden={!simbolo} />
      {milimetrosPorModulo !== null && (
        <p className="hierarquia-vazio">
          Em uma etiqueta de {ALTURA_ETIQUETA_MM} mm de altura, cada módulo do código fica com cerca de{' '}
          {milimetrosPorModulo.toFixed(1).replace('.', ',')} mm.
        </p>
      )}
      <div className="modal-acoes">
        <button type="button" onClick={baixar} disabled={!simbolo}>
          Baixar etiqueta (PNG)
        </button>
        <button type="button" onClick={onFechar}>
          Fechar
        </button>
      </div>
    </ModalBase>
  );
}
