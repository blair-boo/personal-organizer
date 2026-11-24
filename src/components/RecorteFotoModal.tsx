import { useEffect, useRef, useState, type KeyboardEvent, type PointerEvent } from 'react';
import { ModalBase } from './ModalBase';
import { IconeFuncao } from './IconeUso';
import { useToast } from './Toast';
import { LADO_DA_FOTO, ZOOM_MAXIMO, ZOOM_MINIMO, aplicarZoom, moverImagem, posicaoCentralizada, type PosicaoDaImagem } from '../lib/recorteFoto';

/** Lado do quadrado de recorte na tela, em px. */
const LADO_NA_TELA = 280;
const PASSO_SETA = 12;

interface RecorteFotoModalProps {
  /** Imagem escolhida pela usuária. */
  arquivo: File;
  /** Nome de quem aparece na foto, para os rótulos de acessibilidade. */
  rotulo: string;
  /** Recebe a foto já recortada (quadrada, JPEG). */
  onConfirmar: (recortada: File) => void;
  onCancelar: () => void;
}

function desenhar(canvas: HTMLCanvasElement, imagem: ImageBitmap, posicao: PosicaoDaImagem, lado: number) {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  const fator = canvas.width / lado;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(imagem, posicao.x * fator, posicao.y * fator, posicao.largura * fator, posicao.altura * fator);
}

/** Recorta a foto para caber no círculo: arrastar para posicionar e ajustar o zoom. A área mostrada é a que fica na foto. */
export function RecorteFotoModal({ arquivo, rotulo, onConfirmar, onCancelar }: RecorteFotoModalProps) {
  const { mostrarToast } = useToast();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const arrasto = useRef<{ x: number; y: number } | null>(null);
  // Guardados em ref para o efeito que abre a imagem rodar só quando o arquivo muda.
  const falhaRef = useRef(() => {});
  useEffect(() => {
    falhaRef.current = () => {
      mostrarToast('Não foi possível abrir essa imagem.', 'erro');
      onCancelar();
    };
  });
  const [imagem, setImagem] = useState<ImageBitmap | null>(null);
  const [zoom, setZoom] = useState(ZOOM_MINIMO);
  const [posicao, setPosicao] = useState<PosicaoDaImagem | null>(null);
  const [gerando, setGerando] = useState(false);

  useEffect(() => {
    let ativo = true;
    let aberta: ImageBitmap | null = null;
    // 'from-image' respeita a rotação gravada pela câmera do celular.
    createImageBitmap(arquivo, { imageOrientation: 'from-image' })
      .then((bitmap) => {
        if (!ativo) {
          bitmap.close();
          return;
        }
        aberta = bitmap;
        setImagem(bitmap);
        setPosicao(posicaoCentralizada(bitmap.width, bitmap.height, LADO_NA_TELA, ZOOM_MINIMO));
      })
      .catch(() => {
        if (ativo) falhaRef.current();
      });
    return () => {
      ativo = false;
      aberta?.close();
    };
  }, [arquivo]);

  useEffect(() => {
    if (canvasRef.current && imagem && posicao) desenhar(canvasRef.current, imagem, posicao, LADO_NA_TELA);
  }, [imagem, posicao]);

  function aoMudarZoom(valor: number) {
    setZoom(valor);
    if (imagem && posicao) setPosicao(aplicarZoom(posicao, imagem.width, imagem.height, LADO_NA_TELA, valor));
  }

  function aoPressionar(e: PointerEvent<HTMLCanvasElement>) {
    e.currentTarget.setPointerCapture(e.pointerId);
    arrasto.current = { x: e.clientX, y: e.clientY };
  }

  function aoArrastar(e: PointerEvent<HTMLCanvasElement>) {
    if (!arrasto.current || !posicao) return;
    const dx = e.clientX - arrasto.current.x;
    const dy = e.clientY - arrasto.current.y;
    arrasto.current = { x: e.clientX, y: e.clientY };
    setPosicao(moverImagem(posicao, dx, dy, LADO_NA_TELA));
  }

  function aoTeclar(e: KeyboardEvent<HTMLCanvasElement>) {
    if (!posicao) return;
    const passos: Record<string, [number, number]> = { ArrowLeft: [PASSO_SETA, 0], ArrowRight: [-PASSO_SETA, 0], ArrowUp: [0, PASSO_SETA], ArrowDown: [0, -PASSO_SETA] };
    const passo = passos[e.key];
    if (!passo) return;
    e.preventDefault();
    setPosicao(moverImagem(posicao, passo[0], passo[1], LADO_NA_TELA));
  }

  function confirmar() {
    if (!imagem || !posicao) return;
    setGerando(true);
    const saida = document.createElement('canvas');
    saida.width = LADO_DA_FOTO;
    saida.height = LADO_DA_FOTO;
    desenhar(saida, imagem, posicao, LADO_NA_TELA);
    saida.toBlob(
      (blob) => {
        setGerando(false);
        if (!blob) {
          mostrarToast('Não foi possível recortar a imagem.', 'erro');
          return;
        }
        onConfirmar(new File([blob], 'foto.jpg', { type: 'image/jpeg' }));
      },
      'image/jpeg',
      0.9
    );
  }

  return (
    <ModalBase aberto rotulo={`Recortar a foto de ${rotulo}`} onFechar={onCancelar} classe="modal-edicao">
      <h3 className="modal-titulo">Recortar a foto de {rotulo}</h3>
      <p className="hierarquia-vazio">Arraste para posicionar e use o zoom. O círculo é o que aparece na foto.</p>
      <div className="recorte-foto-area">
        <canvas
          ref={canvasRef}
          className="recorte-foto-canvas"
          width={LADO_NA_TELA}
          height={LADO_NA_TELA}
          tabIndex={0}
          aria-label={`Área de recorte da foto de ${rotulo}. Use as setas para mover a imagem.`}
          onPointerDown={aoPressionar}
          onPointerMove={aoArrastar}
          onPointerUp={() => (arrasto.current = null)}
          onPointerCancel={() => (arrasto.current = null)}
          onKeyDown={aoTeclar}
        />
      </div>
      <label>
        Zoom
        <input type="range" min={ZOOM_MINIMO} max={ZOOM_MAXIMO} step={0.05} value={zoom} onChange={(e) => aoMudarZoom(Number(e.target.value))} aria-label="Zoom da foto" />
      </label>
      <div className="modal-acoes">
        <button type="button" className="btn-icone" onClick={confirmar} disabled={!imagem || gerando} title="Salvar foto" aria-label="Salvar foto" data-autofocus>
          <IconeFuncao funcao="salvar" />
        </button>
        <button type="button" className="btn-icone" onClick={onCancelar} title="Cancelar" aria-label="Cancelar">
          <IconeFuncao funcao="excluir" />
        </button>
      </div>
    </ModalBase>
  );
}
