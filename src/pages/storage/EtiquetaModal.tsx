import { useEffect, useRef, useState } from 'react';
import { ModalBase } from '../../components/ModalBase';
import { useToast } from '../../components/Toast';
import { mensagemDeErro } from '../../lib/erros';
import { codigoDaCaixa } from '../../lib/caixas';
import { slugify } from '../../lib/storage';
import type { CaixaStorage } from '../../types';
import type { SimboloRmqr } from '../../lib/rmqr';
import { baixarBlob, canvasParaPng, desenharEtiqueta } from './desenharEtiquetas';

/** Pixels por módulo no PNG baixado (grande, pra imprimir sem borrar). */
const ESCALA_DOWNLOAD = 10;
const ESCALA_PREVIA = 6;
/** Altura máxima da etiqueta da impressora, em mm (só pra mostrar o tamanho do módulo). */
const ALTURA_ETIQUETA_MM = 14;

/** Mostra a etiqueta (rMQR com o código da caixa, e o nome ao lado se quiser) e baixa o PNG pra imprimir. */
export function EtiquetaModal({ caixa, onFechar }: { caixa: CaixaStorage; onFechar: () => void }) {
  const { mostrarToast } = useToast();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [simbolo, setSimbolo] = useState<SimboloRmqr | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [incluirNome, setIncluirNome] = useState(true);
  const codigo = codigoDaCaixa(caixa.numero);

  useEffect(() => {
    let ativo = true;
    void (async () => {
      try {
        const { gerarSimboloRmqr } = await import('../../lib/rmqr');
        const gerado = await gerarSimboloRmqr(codigo);
        if (ativo) setSimbolo(gerado);
      } catch (err) {
        if (ativo) setErro(mensagemDeErro(err));
      }
    })();
    return () => {
      ativo = false;
    };
  }, [codigo]);

  useEffect(() => {
    if (simbolo && canvasRef.current) desenharEtiqueta(canvasRef.current, { codigo, nome: caixa.nome, simbolo }, ESCALA_PREVIA, incluirNome);
  }, [simbolo, incluirNome, codigo, caixa.nome]);

  async function baixar() {
    if (!simbolo) return;
    try {
      const canvas = document.createElement('canvas');
      desenharEtiqueta(canvas, { codigo, nome: caixa.nome, simbolo }, ESCALA_DOWNLOAD, incluirNome);
      baixarBlob(await canvasParaPng(canvas), `etiqueta-${slugify(codigo)}.png`);
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
      {erro ? <p role="alert">{erro}</p> : !simbolo ? <p>Carregando…</p> : null}
      <canvas ref={canvasRef} className="storage-etiqueta" aria-label={`Código ${codigo}`} hidden={!simbolo} />
      <label className="manutencao-opcao-base">
        <input type="checkbox" checked={incluirNome} onChange={(e) => setIncluirNome(e.target.checked)} />
        Incluir o nome da caixa ao lado do código
      </label>
      {milimetrosPorModulo !== null && (
        <p className="hierarquia-vazio">
          Em uma etiqueta de {ALTURA_ETIQUETA_MM} mm de altura, cada módulo do código fica com cerca de {milimetrosPorModulo.toFixed(1).replace('.', ',')} mm.
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
