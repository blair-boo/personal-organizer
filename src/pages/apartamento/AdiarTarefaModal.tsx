import { useState } from 'react';
import { ModalBase } from '../../components/ModalBase';
import { formatarData, somarDias } from '../../lib/datas';
import { ATALHOS_ADIAR } from '../../lib/adiamentos';
import { dataAoPular, proximaExecucao } from '../../lib/manutencao';
import type { PessoaDocumentos, TarefaManutencao, TipoAdiamento } from '../../types';

export interface ConfirmacaoDeAdiamento {
  /** Nova data da próxima execução, ou null para cancelar o adiamento. */
  adiadaAte: string | null;
  tipo: TipoAdiamento;
  observacao: string | null;
  /** Mensagem do toast de sucesso. */
  rotulo: string;
}

interface AdiarTarefaModalProps {
  tarefa: TarefaManutencao;
  hoje: string;
  /** Quem está adiando (o dono da conta); null se o login ainda não está ligado a uma pessoa. */
  quemAdia: PessoaDocumentos | null;
  onConfirmar: (confirmacao: ConfirmacaoDeAdiamento) => void;
  onCancelar: () => void;
}

/** Adia a tarefa para uma data ou "pula desta vez" (passa para o próximo ciclo sem registrar como feita), com observação opcional. */
export function AdiarTarefaModal({ tarefa, hoje, quemAdia, onConfirmar, onCancelar }: AdiarTarefaModalProps) {
  const atual = proximaExecucao(tarefa);
  const baseAtalhos = atual > hoje ? atual : hoje;
  const [data, setData] = useState(() => somarDias(baseAtalhos, 1));
  const [observacao, setObservacao] = useState('');
  const aoPular = dataAoPular(tarefa);
  const obs = observacao.trim() || null;

  return (
    <ModalBase aberto rotulo={`Adiar: ${tarefa.nome}`} onFechar={onCancelar}>
      <h3 className="modal-titulo">Adiar tarefa</h3>
      <p>{tarefa.nome}</p>
      <p className="hierarquia-vazio">Próxima execução prevista: {formatarData(atual)}.</p>
      <p className="hierarquia-vazio">
        {quemAdia ? `Quem adia: ${quemAdia.nome}.` : 'Seu login ainda não está ligado a uma pessoa de Documentos. O adiamento ficará sem nome.'}
      </p>
      <div className="manutencao-adiar-atalhos" role="group" aria-label="Atalhos de data">
        {ATALHOS_ADIAR.map((atalho) => (
          <button key={atalho.dias} type="button" className="tag-opcao" onClick={() => setData(somarDias(baseAtalhos, atalho.dias))}>
            {atalho.rotulo}
          </button>
        ))}
      </div>
      <label className="manutencao-opcao-base">
        Adiar para
        <input type="date" value={data} min={hoje} onChange={(e) => setData(e.target.value)} />
      </label>
      <label>
        Observação (opcional)
        <textarea value={observacao} onChange={(e) => setObservacao(e.target.value)} rows={3} />
      </label>
      <div className="modal-acoes">
        <button type="button" disabled={!data} onClick={() => onConfirmar({ adiadaAte: data, tipo: 'adiada', observacao: obs, rotulo: `Adiada para ${formatarData(data)}.` })} data-autofocus>
          Adiar
        </button>
        <button type="button" onClick={() => onConfirmar({ adiadaAte: aoPular, tipo: 'pulada', observacao: obs, rotulo: `Pulada desta vez. Próxima em ${formatarData(aoPular)}.` })}>
          Pular desta vez (próxima em {formatarData(aoPular)})
        </button>
        {tarefa.adiada_ate && (
          <button type="button" onClick={() => onConfirmar({ adiadaAte: null, tipo: 'cancelada', observacao: obs, rotulo: 'Adiamento cancelado.' })}>
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
