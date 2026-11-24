import { useId, useState } from 'react';
import { IconeFuncao } from '../../components/IconeUso';
import { IconeBandeira } from '../../components/IconesProvisorios';
import { IconePessoa } from '../../components/IconePessoa';
import { useDialogos } from '../../components/Dialogo';
import { useToast } from '../../components/Toast';
import { mensagemDeErro } from '../../lib/erros';
import { formatarData } from '../../lib/datas';
import { ROTULOS_TIPO_ADIAMENTO } from '../../lib/adiamentos';
import { entradaAtrasada, ROTULOS_BASE } from '../../lib/historicoTarefa';
import { useAtualizarExecucaoTarefa, useDefinirPessoasExecucao, useExcluirExecucaoTarefa, useIncluirExecucaoTarefa } from '../../hooks/useTarefasHistorico';
import type { AdiamentoTarefa, BaseProximaExecucao, HistoricoTarefa, PessoaDocumentos, TarefaManutencao } from '../../types';

interface HistoricoTarefaSecaoProps {
  tarefa: TarefaManutencao;
  /** Execuções desta tarefa, da mais recente para a mais antiga. */
  entradas: HistoricoTarefa[];
  /** Adiamentos desta tarefa, do mais recente para o mais antigo. */
  adiamentos: AdiamentoTarefa[];
  /** Pessoas individuais, para marcar quem fez. */
  pessoas: PessoaDocumentos[];
  /** Execução -> ids de quem fez. */
  pessoasPorEntrada: Map<string, string[]>;
  nomePorPessoa: Map<string, string>;
  hoje: string;
}

/**
 * Histórico da tarefa, recolhido no pé do cartão e aberto para baixo ao clicar: datas em que foi feita
 * (trocar a data, incluir outra à mão, excluir, quem fez, de onde conta a próxima nas feitas com atraso)
 * e os adiamentos (quem adiou, para quando e a observação).
 */
export function HistoricoTarefaSecao({ tarefa, entradas, adiamentos, pessoas, pessoasPorEntrada, nomePorPessoa, hoje }: HistoricoTarefaSecaoProps) {
  const [aberto, setAberto] = useState(false);
  const idConteudo = useId();
  const total = entradas.length + adiamentos.length;

  return (
    <div className="manutencao-historico">
      <button
        type="button"
        className={`manutencao-historico-botao${aberto ? ' manutencao-historico-botao-aberto' : ''}`}
        aria-expanded={aberto}
        aria-controls={idConteudo}
        onClick={() => setAberto((a) => !a)}
        title={aberto ? `Recolher o histórico de ${tarefa.nome}` : `Mostrar o histórico de ${tarefa.nome}`}
      >
        Histórico{total > 0 ? ` (${total})` : ''}
      </button>
      <div id={idConteudo} hidden={!aberto}>
        {aberto && <ConteudoHistorico tarefa={tarefa} entradas={entradas} adiamentos={adiamentos} pessoas={pessoas} pessoasPorEntrada={pessoasPorEntrada} nomePorPessoa={nomePorPessoa} hoje={hoje} />}
      </div>
    </div>
  );
}

function ConteudoHistorico({ tarefa, entradas, adiamentos, pessoas, pessoasPorEntrada, nomePorPessoa, hoje }: HistoricoTarefaSecaoProps) {
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
    <div className="manutencao-historico-conteudo">
      <h4 className="manutencao-historico-subtitulo">Execuções</h4>
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
                        <IconePessoa pessoa={p} tamanho={14} />
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

      <h4 className="manutencao-historico-subtitulo">Adiamentos</h4>
      <ul className="lista-documentos">
        {adiamentos.map((a) => {
          const quem = a.pessoa_id ? nomePorPessoa.get(a.pessoa_id) : undefined;
          const quando = formatarData(a.criado_em.slice(0, 10));
          return (
            <li key={a.id} className="manutencao-historico-linha">
              <span>
                {ROTULOS_TIPO_ADIAMENTO[a.tipo]}
                {a.adiada_para ? ` para ${formatarData(a.adiada_para)}` : ''}
                {quem ? ` por ${quem}` : ''} em {quando}.
              </span>
              {a.observacao && <span className="conta-detalhe">Observação: {a.observacao}</span>}
            </li>
          );
        })}
        {adiamentos.length === 0 && <li className="hierarquia-vazio">Nenhum adiamento registrado.</li>}
      </ul>
    </div>
  );
}
