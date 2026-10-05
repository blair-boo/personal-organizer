import { useState } from 'react';
import { ModalBase } from './ModalBase';
import { useDialogos } from './Dialogo';
import { useToast } from './Toast';
import { IconeDoUso, IconeFuncao } from './IconeUso';
import { ModalIcone } from './ModalIcone';
import { useRemoverUsoIcone, useSalvarUsoIcone } from '../hooks/useIconesUsos';
import { useRotulosAlvos } from '../hooks/useRotulosAlvos';
import { mensagemDeErro } from '../lib/erros';
import type { UsoIcone } from '../types';

interface ModalUsosIconeProps {
  /** Instâncias (categorias e abas) que usam o ícone. */
  usos: UsoIcone[];
  tamanho: number;
  onFechar: () => void;
}

/**
 * Pop-up de Ícones (UI): mostra onde o ícone é usado. Escolha o título e substitua o
 * ícone só naquela instância, ou remova (o arquivo continua na lista de ícones).
 */
export function ModalUsosIcone({ usos, tamanho, onFechar }: ModalUsosIconeProps) {
  const rotuloDe = useRotulosAlvos();
  const { confirmar } = useDialogos();
  const { mostrarToast } = useToast();
  const salvar = useSalvarUsoIcone();
  const remover = useRemoverUsoIcone();
  const [escolhido, setEscolhido] = useState<UsoIcone | null>(usos[0] ?? null);
  const [substituindo, setSubstituindo] = useState(false);

  // Se a instância escolhida deixou de existir (removida), volta para a primeira que restar.
  const atual = escolhido && usos.find((u) => u.alvo_tipo === escolhido.alvo_tipo && u.alvo_id === escolhido.alvo_id && u.tema === escolhido.tema);
  const selecionado = atual ?? usos[0] ?? null;

  async function aoSubstituir(uso: UsoIcone) {
    try {
      await salvar.mutateAsync(uso);
      mostrarToast('Ícone substituído.');
      setSubstituindo(false);
      setEscolhido(uso);
    } catch (err) {
      mostrarToast(mensagemDeErro(err), 'erro');
    }
  }

  async function aoRemover() {
    if (!selecionado) return;
    const nome = rotuloDe(selecionado.alvo_tipo, selecionado.alvo_id);
    const ok = await confirmar({
      titulo: 'Remover ícone?',
      mensagem: `O ícone sai de "${nome}". O arquivo continua disponível na lista de ícones.`,
      confirmarRotulo: 'Remover',
      perigoso: true,
    });
    if (!ok) return;
    try {
      await remover.mutateAsync({ alvoTipo: selecionado.alvo_tipo, alvoId: selecionado.alvo_id, tema: selecionado.tema });
      mostrarToast('Ícone removido.');
      if (usos.length <= 1) onFechar();
    } catch (err) {
      mostrarToast(mensagemDeErro(err), 'erro');
    }
  }

  if (!selecionado) {
    return (
      <ModalBase aberto rotulo="Onde o ícone é usado" onFechar={onFechar} classe="modal-usos">
        <h2 className="modal-titulo">Onde o ícone é usado</h2>
        <p className="hierarquia-vazio">Este ícone não está mais em uso.</p>
      </ModalBase>
    );
  }

  return (
    <>
      <ModalBase aberto rotulo="Onde o ícone é usado" onFechar={onFechar} classe="modal-usos">
        <h2 className="modal-titulo">Onde o ícone é usado</h2>
        <ul className="modal-usos-lista">
          {usos.map((u) => {
            const chave = `${u.alvo_tipo}:${u.alvo_id}:${u.tema}`;
            const marcado = u.alvo_tipo === selecionado.alvo_tipo && u.alvo_id === selecionado.alvo_id && u.tema === selecionado.tema;
            return (
              <li key={chave}>
                <label>
                  <input type="radio" name="uso-icone" checked={marcado} onChange={() => setEscolhido(u)} />
                  <IconeDoUso uso={u} tamanhoBase={tamanho} />
                  {rotuloDe(u.alvo_tipo, u.alvo_id)}
                  {u.tema !== 'ambos' && ` (${u.tema})`}
                </label>
              </li>
            );
          })}
        </ul>
        <div className="modal-acoes modal-icone-acoes">
          <button type="button" className="btn-icone btn-icone-perigo icone-uso-botao" onClick={() => void aoRemover()} title="Remover ícone deste título" aria-label="Remover ícone deste título">
            <IconeFuncao funcao="excluir" />
          </button>
          <button type="button" className="btn-icone icone-uso-botao" onClick={() => setSubstituindo(true)} title="Substituir ícone deste título" aria-label="Substituir ícone deste título">
            <IconeFuncao funcao="editar" />
          </button>
        </div>
      </ModalBase>
      {substituindo && (
        <ModalIcone
          aberto
          rotuloAlvo={rotuloDe(selecionado.alvo_tipo, selecionado.alvo_id)}
          alvoTipo={selecionado.alvo_tipo}
          alvoId={selecionado.alvo_id}
          inicial={selecionado}
          tamanhoBase={tamanho}
          permiteRemover={false}
          onConfirmar={(uso) => void aoSubstituir(uso)}
          onFechar={() => setSubstituindo(false)}
        />
      )}
    </>
  );
}
