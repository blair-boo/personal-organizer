import { useState } from 'react';
import { ModalBase } from '../../components/ModalBase';
import { IconeFuncao } from '../../components/IconeUso';
import { IconeBandeira } from '../../components/IconesProvisorios';
import { useDialogos } from '../../components/Dialogo';
import { useToast } from '../../components/Toast';
import { mensagemDeErro } from '../../lib/erros';
import { formatarData } from '../../lib/datas';
import { entradaAtrasada, ROTULOS_BASE } from '../../lib/historicoTarefa';
import { useAtualizarExecucaoTarefa, useDefinirPessoasExecucao, useExcluirExecucaoTarefa, useIncluirExecucaoTarefa } from '../../hooks/useTarefasHistorico';
import type { BaseProximaExecucao, HistoricoTarefa, PessoaDocumentos, TarefaManutencao } from '../../types';

interface HistoricoTarefaModalProps {
  tarefa: TarefaManutencao;
  /** Execuções desta tarefa, da mais recente para a mais antiga. */
  entradas: HistoricoTarefa[];
  /** Pessoas individuais, para marcar quem fez. */
  pessoas: PessoaDocumentos[];
  /** Execução -> ids de quem fez. */
  pessoasPorEntrada: Map<string, string[]>;
  hoje: string;
  onFechar: () => void;
}

/** Datas em que a tarefa foi feita: trocar a data, incluir outra à mão, excluir, e escolher de onde conta a próxima nas feitas com atraso. */
export function HistoricoTarefaModal({ tarefa, entradas, pessoas, pessoasPorEntrada, hoje, onFechar }: HistoricoTarefaModalProps) {
  const atualizar = useAtualizarExecucaoTarefa();
  const excluir = useExcluirExecucaoTarefa();
  const incluir = useIncluirExecucaoTarefa();
  const definirPessoas = useDefinirPessoasExecucao();
  const { confirmar } = useDialogos();
  const { mostrarToast } = useToast();
  const [novaData, setNovaData] = useState(hoje);

  async function executar(acao: () => Promise<unknown>, sucesso: string) {
    try {
      await acao();
      mostrarToast(sucesso);
    } catch (err) {
      mostrarToast(mensagemDeErro(err), 'erro');
    }
  }

  async function aoExcluir(entrada: HistoricoTarefa) {
    const ok = await confirmar({
      titulo: `Excluir a execução de ${formatarData(entrada.data_execucao)}?`,
      mensagem: 'A próxima execução da tarefa será recalculada pelas datas que restarem.',
      confirmarRotulo: 'Excluir',
      perigoso: true,
    });
    if (!ok) return;
    await executar(() => excluir.mutateAsync({ id: entrada.id, tarefaId: tarefa.id }), 'Execução excluída.');
  }

  return (
    <ModalBase aberto rotulo={`Histórico de ${tarefa.nome}`} onFechar={onFechar} classe="modal-edicao">
      <h3 className="modal-titulo">Histórico: {tarefa.nome}</h3>

      <ul className="lista-documentos">
        {entradas.map((entrada) => {
          const atrasada = entradaAtrasada(entrada);
          return (
            <li key={entrada.id} className="manutencao-historico-linha">
              <div className="manutencao-historico-topo">
                <input
                  type="date"
                  value={entrada.data_execucao}
                  max={hoje}
                  aria-label="Data em que foi feita"
                  onChange={(e) => {
                    if (e.target.value && e.target.value !== entrada.data_execucao) {
                      void executar(() => atualizar.mutateAsync({ id: entrada.id, tarefaId: tarefa.id, dataExecucao: e.target.value }), 'Data atualizada.');
                    }
                  }}
                />
                <button
                  type="button"
                  className="btn-icone btn-icone-perigo"
                  onClick={() => aoExcluir(entrada)}
                  title={`Excluir a execução de ${formatarData(entrada.data_execucao)}`}
                  aria-label={`Excluir a execução de ${formatarData(entrada.data_execucao)}`}
                >
                  <IconeFuncao funcao="excluir" />
                </button>
              </div>
              {pessoas.length > 0 && (
                <div className="manutencao-historico-atraso" role="group" aria-label={`Quem fez em ${formatarData(entrada.data_execucao)}`}>
                  <span className="conta-detalhe">Quem fez:</span>
                  {pessoas.map((p) => {
                    const fizeram = pessoasPorEntrada.get(entrada.id) ?? [];
                    const marcada = fizeram.includes(p.id);
                    return (
                      <button
                        key={p.id}
                        type="button"
                        className={marcada ? 'tag-opcao tag-opcao-ativa' : 'tag-opcao'}
                        aria-pressed={marcada}
                        onClick={() =>
                          void executar(
                            () => definirPessoas.mutateAsync({ historicoId: entrada.id, pessoaIds: marcada ? fizeram.filter((id) => id !== p.id) : [...fizeram, p.id] }),
                            'Quem fez atualizado.'
                          )
                        }
                      >
                        {p.nome}
                      </button>
                    );
                  })}
                </div>
              )}
              {atrasada && entrada.data_prevista && (
                <div className="manutencao-historico-atraso">
                  <span className="manutencao-flag-atraso">
                    <IconeBandeira /> Feita com atraso (devia ser {formatarData(entrada.data_prevista)})
                  </span>
                  <select
                    value={entrada.base_proxima}
                    aria-label="De onde conta a próxima execução"
                    onChange={(e) =>
                      void executar(() => atualizar.mutateAsync({ id: entrada.id, tarefaId: tarefa.id, base: e.target.value as BaseProximaExecucao }), 'Base da próxima execução atualizada.')
                    }
                  >
                    {(Object.keys(ROTULOS_BASE) as BaseProximaExecucao[]).map((base) => (
                      <option key={base} value={base}>
                        {ROTULOS_BASE[base]}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </li>
          );
        })}
        {entradas.length === 0 && <li className="hierarquia-vazio">Nenhuma execução registrada ainda.</li>}
      </ul>

      <div className="upload-form">
        <input type="date" value={novaData} max={hoje} aria-label="Data a incluir" onChange={(e) => setNovaData(e.target.value)} />
        <button
          type="button"
          disabled={!novaData || incluir.isPending}
          onClick={() => void executar(() => incluir.mutateAsync({ tarefaId: tarefa.id, dataExecucao: novaData, frequenciaDias: tarefa.frequencia_dias }), 'Data incluída.')}
        >
          + Data
        </button>
      </div>

      <div className="modal-acoes">
        <button type="button" onClick={onFechar}>
          Fechar
        </button>
      </div>
    </ModalBase>
  );
}
