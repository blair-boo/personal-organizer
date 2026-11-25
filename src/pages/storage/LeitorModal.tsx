import { useEffect, useRef, useState } from 'react';
import { ModalBase } from '../../components/ModalBase';
import { useToast } from '../../components/Toast';
import { mensagemDeErro } from '../../lib/erros';
import { numeroDoCodigo } from '../../lib/caixas';

/** Intervalo entre leituras da câmera: mais espaçado poupa bateria e o aparelho. */
const INTERVALO_LEITURA_MS = 250;
/** Largura máxima do quadro analisado; a câmera entrega mais que isso e não ajuda a ler. */
const LARGURA_MAXIMA_QUADRO = 960;

interface LeitorModalProps {
  onFechar: () => void;
  /** Número da caixa lido na etiqueta. */
  onLido: (numero: number) => void;
}

/** Lê a etiqueta (rMQR ou QR) da caixa pela câmera ou por uma imagem. Funciona sem internet. */
export function LeitorModal({ onFechar, onLido }: LeitorModalProps) {
  const { mostrarToast } = useToast();
  const videoRef = useRef<HTMLVideoElement>(null);
  const onLidoRef = useRef(onLido);
  useEffect(() => {
    onLidoRef.current = onLido;
  }, [onLido]);
  const [status, setStatus] = useState('Abrindo a câmera…');
  const [semCamera, setSemCamera] = useState(false);
  const [lendoImagem, setLendoImagem] = useState(false);

  useEffect(() => {
    let ativo = true;
    let temporizador: ReturnType<typeof setTimeout> | undefined;
    let stream: MediaStream | null = null;

    async function iniciar() {
      if (!navigator.mediaDevices?.getUserMedia) {
        setSemCamera(true);
        setStatus('Este aparelho ou navegador não deixa usar a câmera aqui. Escolha uma imagem da etiqueta.');
        return;
      }
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' } }, audio: false });
      } catch {
        if (!ativo) return;
        setSemCamera(true);
        setStatus('Não foi possível abrir a câmera. Libere o acesso nas permissões do navegador ou escolha uma imagem da etiqueta.');
        return;
      }
      if (!ativo) {
        stream.getTracks().forEach((t) => t.stop());
        return;
      }
      const video = videoRef.current;
      if (!video) return;
      video.srcObject = stream;
      await video.play().catch(() => undefined);
      setStatus('Aponte a câmera para a etiqueta da caixa.');

      const { lerCodigos } = await import('../../lib/rmqr');
      const canvas = document.createElement('canvas');
      const contexto = canvas.getContext('2d', { willReadFrequently: true });
      let ultimoTextoIgnorado = '';

      async function ler() {
        if (!ativo || !contexto) return;
        if (video && video.readyState >= 2 && video.videoWidth > 0) {
          const escala = Math.min(1, LARGURA_MAXIMA_QUADRO / video.videoWidth);
          canvas.width = Math.round(video.videoWidth * escala);
          canvas.height = Math.round(video.videoHeight * escala);
          contexto.drawImage(video, 0, 0, canvas.width, canvas.height);
          try {
            const textos = await lerCodigos(contexto.getImageData(0, 0, canvas.width, canvas.height));
            const texto = textos[0];
            if (ativo && texto) {
              const numero = numeroDoCodigo(texto);
              if (numero !== null) {
                ativo = false;
                onLidoRef.current(numero);
                return;
              }
              if (texto !== ultimoTextoIgnorado) {
                ultimoTextoIgnorado = texto;
                mostrarToast('Esse código não é de uma caixa.', 'erro');
              }
            }
          } catch (err) {
            if (ativo) setStatus(mensagemDeErro(err));
          }
        }
        if (ativo) temporizador = setTimeout(ler, INTERVALO_LEITURA_MS);
      }
      void ler();
    }

    void iniciar();
    return () => {
      ativo = false;
      if (temporizador) clearTimeout(temporizador);
      stream?.getTracks().forEach((t) => t.stop());
    };
  }, [mostrarToast]);

  async function lerImagem(arquivo: File | undefined) {
    if (!arquivo) return;
    setLendoImagem(true);
    try {
      const { lerCodigos } = await import('../../lib/rmqr');
      const textos = await lerCodigos(arquivo);
      const numero = textos.length > 0 ? numeroDoCodigo(textos[0]) : null;
      if (numero === null) {
        mostrarToast(textos.length > 0 ? 'Esse código não é de uma caixa.' : 'Nenhum código encontrado na imagem.', 'erro');
        return;
      }
      onLido(numero);
    } catch (err) {
      mostrarToast(mensagemDeErro(err), 'erro');
    } finally {
      setLendoImagem(false);
    }
  }

  return (
    <ModalBase aberto rotulo="Ler código da caixa" onFechar={onFechar} classe="modal-edicao modal-storage" titulo="Ler código da caixa" perguntarAoDescartar={false}>
      {!semCamera && <video ref={videoRef} className="storage-video" playsInline muted aria-label="Imagem da câmera" />}
      <p role="status">{status}</p>
      <label className="storage-arquivo-imagem">
        Ou escolha uma imagem da etiqueta
        <input type="file" accept="image/*" disabled={lendoImagem} onChange={(e) => void lerImagem(e.target.files?.[0])} />
      </label>
    </ModalBase>
  );
}
