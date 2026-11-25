import { useState } from 'react';
import { ModalBase } from '../../components/ModalBase';
import { formatarData, somarDias } from '../../lib/datas';
import type { BaseProximaExecucao, PessoaDocumentos, TarefaManutencao } from '../../types';

interface FeitaHojeModalProps {
  tarefa: TarefaManutencao;
  /** Quando deveria ter sido feita, se a tarefa está atrasada; null = em dia (não pergunta a base). */
  dataPrevistaAtrasada: string | null;
  hoje: string;
  /** Pessoas que podem ter feito (as individuais). */
  pessoas: PessoaDocumentos[];
  /** Quem já vem marcado. */
  padrao: string[];
  onConfirmar: (dados: { base: BaseProximaExecucao; pessoaIds: string[] }) => void;
  onCancelar: () => void;
}

/** "Feita hoje": quem fez (uma ou mais pessoas) e, se a tarefa estava atrasada, de onde conta a próxima (começa em "voltar à data original"). */
export function FeitaHojeModal({ tarefa, dataPrevistaAtrasada, hoje, pessoas, padrao, onConfirmar, onCancelar }: FeitaHojeModalProps) {
  const [base, setBase] = useState<BaseProximaExecucao>('prevista');
  const [marcadas, setMarcadas] = useState<Set<string>>(new Set(padrao));

  function alternar(id: string) {
    setMarcadas((atual) => {
      const novo = new Set(atual);
      if (novo.has(id)) novo.delete(id);
      else novo.add(id);
      return novo;
    });
  }

  return (
    <ModalBase aberto rotulo={`Feita hoje: ${tarefa.nome}`} onFechar={onCancelar} titulo="Feita hoje" rodape={
        <>
          <button type="button" onClick={() => onConfirmar({ base: dataPrevistaAtrasada ? base : 'execucao', pessoaIds: pessoas.filter((p) => marcadas.has(p.id)).map((p) => p.id) })} data-autofocus>
            Confirmar
          </button>
        </>
      }>
      <p>{tarefa.nome}</p>
      {pessoas.length > 0 && (
        <fieldset className="manutencao-destino">
          <legend>Quem fez</legend>
          {pessoas.map((p) => (
            <label key={p.id} className="manutencao-opcao-base">
              <input type="checkbox" checked={marcadas.has(p.id)} onChange={() => alternar(p.id)} />
              {p.nome}
            </label>
          ))}
          {marcadas.size > 1 && <p className="hierarquia-vazio">As pessoas marcadas fizeram juntas.</p>}
        </fieldset>
      )}
      {dataPrevistaAtrasada && (
        <fieldset className="manutencao-destino">
          <legend>Tarefa atrasada: devia ter sido feita em {formatarData(dataPrevistaAtrasada)}. De onde conta a próxima?</legend>
          <label className="manutencao-opcao-base">
            <input type="radio" name="base-proxima" checked={base === 'prevista'} onChange={() => setBase('prevista')} />
            Voltar à data original: próxima em {formatarData(somarDias(dataPrevistaAtrasada, tarefa.frequencia_dias))}
          </label>
          <label className="manutencao-opcao-base">
            <input type="radio" name="base-proxima" checked={base === 'execucao'} onChange={() => setBase('execucao')} />A partir de hoje: próxima em{' '}
            {formatarData(somarDias(hoje, tarefa.frequencia_dias))}
          </label>
        </fieldset>
      )}
    </ModalBase>
  );
}
