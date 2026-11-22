import { useState } from 'react';
import { ModalBase } from '../../components/ModalBase';
import { useToast } from '../../components/Toast';
import { mensagemDeErro } from '../../lib/erros';
import { codigoDaCaixa } from '../../lib/caixas';
import type { CaixaStorage } from '../../types';
import { baixarBlob, canvasParaPng, desenharFolha, type EtiquetaParaDesenhar } from './desenharEtiquetas';

/** Escolhe várias caixas e baixa as etiquetas numa imagem só (grade de duas colunas), para imprimir de uma vez. */
export function EtiquetasLoteModal({ caixas, onFechar }: { caixas: CaixaStorage[]; onFechar: () => void }) {
  const { mostrarToast } = useToast();
  const [marcadas, setMarcadas] = useState<Set<string>>(new Set());
  const [incluirNome, setIncluirNome] = useState(true);
  const [gerando, setGerando] = useState(false);

  function alternar(id: string) {
    setMarcadas((atual) => {
      const novo = new Set(atual);
      if (novo.has(id)) novo.delete(id);
      else novo.add(id);
      return novo;
    });
  }

  const todasMarcadas = caixas.length > 0 && marcadas.size === caixas.length;

  async function baixar() {
    setGerando(true);
    try {
      const { gerarSimboloRmqr } = await import('../../lib/rmqr');
      const etiquetas: EtiquetaParaDesenhar[] = [];
      for (const caixa of caixas.filter((c) => marcadas.has(c.id))) {
        const codigo = codigoDaCaixa(caixa.numero);
        etiquetas.push({ codigo, nome: caixa.nome, simbolo: await gerarSimboloRmqr(codigo) });
      }
      const canvas = document.createElement('canvas');
      desenharFolha(canvas, etiquetas, incluirNome);
      baixarBlob(await canvasParaPng(canvas), 'etiquetas-storage.png');
      mostrarToast(`${etiquetas.length} etiqueta(s) baixada(s).`);
    } catch (err) {
      mostrarToast(mensagemDeErro(err), 'erro');
    } finally {
      setGerando(false);
    }
  }

  return (
    <ModalBase aberto rotulo="Etiquetas em lote" onFechar={onFechar} classe="modal-edicao modal-storage">
      <h3 className="modal-titulo">Etiquetas em lote</h3>
      {caixas.length === 0 ? (
        <p className="documentos-vazio">Nenhuma caixa ainda.</p>
      ) : (
        <>
          <button type="button" onClick={() => setMarcadas(todasMarcadas ? new Set() : new Set(caixas.map((c) => c.id)))}>
            {todasMarcadas ? 'Desmarcar todas' : 'Marcar todas'}
          </button>
          <ul className="storage-lista-etiquetas">
            {caixas.map((caixa) => (
              <li key={caixa.id}>
                <label className="manutencao-opcao-base">
                  <input type="checkbox" checked={marcadas.has(caixa.id)} onChange={() => alternar(caixa.id)} />
                  {caixa.nome} <span className="storage-codigo">{codigoDaCaixa(caixa.numero)}</span>
                </label>
              </li>
            ))}
          </ul>
        </>
      )}
      <label className="manutencao-opcao-base">
        <input type="checkbox" checked={incluirNome} onChange={(e) => setIncluirNome(e.target.checked)} />
        Incluir o nome da caixa ao lado do código
      </label>
      <div className="modal-acoes">
        <button type="button" onClick={baixar} disabled={marcadas.size === 0 || gerando}>
          {gerando ? 'Gerando…' : `Baixar folha (PNG)${marcadas.size > 0 ? ` com ${marcadas.size}` : ''}`}
        </button>
        <button type="button" onClick={onFechar}>
          Fechar
        </button>
      </div>
    </ModalBase>
  );
}
