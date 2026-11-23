import { useState } from 'react';
import { ModalBase } from '../../components/ModalBase';
import { formatarData, somarDias } from '../../lib/datas';
import { dataAoPular, proximaExecucao } from '../../lib/manutencao';
import type { TarefaManutencao } from '../../types';

interface AdiarTarefaModalProps {
  tarefa: TarefaManutencao;
  hoje: string;
  /** Recebe a nova data da próxima execução, ou null para cancelar o adiamento. */
  onConfirmar: (adiadaAte: string | null, rotulo: string) => void;
  onCancelar: () => void;
}

/** Adia a tarefa para uma data ou "pula desta vez" (passa para o próximo ciclo sem registrar como feita). */
export function AdiarTarefaModal({ tarefa, hoje, onConfirmar, onCancelar }: AdiarTarefaModalProps) {
  const atual = proximaExecucao(tarefa);
  const [data, setData] = useState(() => somarDias(atual > hoje ? atual : hoje, 1));
  const aoPular = dataAoPular(tarefa);

  return (
    <ModalBase aberto rotulo={`Adiar: ${tarefa.nome}`} onFechar={onCancelar}>
      <h3 className="modal-titulo">Adiar tarefa</h3>
      <p>{tarefa.nome}</p>
      <p className="hierarquia-vazio">Próxima execução prevista: {formatarData(atual)}.</p>
      <label className="manutencao-opcao-base">
        Adiar para
        <input type="date" value={data} min={hoje} onChange={(e) => setData(e.target.value)} />
      </label>
      <div className="modal-acoes">
        <button type="button" disabled={!data} onClick={() => onConfirmar(data, `Adiada para ${formatarData(data)}.`)} data-autofocus>
          Adiar
        </button>
        <button type="button" onClick={() => onConfirmar(aoPular, `Pulada desta vez. Próxima em ${formatarData(aoPular)}.`)}>
          Pular desta vez (próxima em {formatarData(aoPular)})
        </button>
        {tarefa.adiada_ate && (
          <button type="button" onClick={() => onConfirmar(null, 'Adiamento cancelado.')}>
            Cancelar adiamento
          </button>
        )}
        <button type="button" onClick={onCancelar}>
          Fechar
        </button>
      </div>
    </ModalBase>
  );
}
