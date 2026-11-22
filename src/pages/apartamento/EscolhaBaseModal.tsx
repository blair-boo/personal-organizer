import { useState } from 'react';
import { ModalBase } from '../../components/ModalBase';
import { formatarData, somarDias } from '../../lib/datas';
import type { BaseProximaExecucao, TarefaManutencao } from '../../types';

interface EscolhaBaseModalProps {
  tarefa: TarefaManutencao;
  /** Quando a tarefa deveria ter sido feita. */
  dataPrevista: string;
  hoje: string;
  onConfirmar: (base: BaseProximaExecucao) => void;
  onCancelar: () => void;
}

/** Tarefa atrasada marcada como feita: de onde conta a próxima. Começa em "voltar à data original". */
export function EscolhaBaseModal({ tarefa, dataPrevista, hoje, onConfirmar, onCancelar }: EscolhaBaseModalProps) {
  const [base, setBase] = useState<BaseProximaExecucao>('prevista');
  return (
    <ModalBase aberto rotulo={`Tarefa atrasada: ${tarefa.nome}`} onFechar={onCancelar}>
      <h3 className="modal-titulo">Tarefa atrasada</h3>
      <p>
        {tarefa.nome} devia ter sido feita em {formatarData(dataPrevista)}. De onde conta a próxima?
      </p>
      <label className="manutencao-opcao-base">
        <input type="radio" name="base-proxima" checked={base === 'prevista'} onChange={() => setBase('prevista')} />
        Voltar à data original: próxima em {formatarData(somarDias(dataPrevista, tarefa.frequencia_dias))}
      </label>
      <label className="manutencao-opcao-base">
        <input type="radio" name="base-proxima" checked={base === 'execucao'} onChange={() => setBase('execucao')} />A partir de hoje: próxima em{' '}
        {formatarData(somarDias(hoje, tarefa.frequencia_dias))}
      </label>
      <div className="modal-acoes">
        <button type="button" onClick={() => onConfirmar(base)} data-autofocus>
          Confirmar
        </button>
        <button type="button" onClick={onCancelar}>
          Cancelar
        </button>
      </div>
    </ModalBase>
  );
}
