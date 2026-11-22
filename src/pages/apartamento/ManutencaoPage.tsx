import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { useSearchParams } from 'react-router-dom';
import { BotaoExportarCsv } from '../../components/BotaoExportarCsv';
import { IconeFuncao } from '../../components/IconeUso';
import { IconeBandeira, IconeKanban, IconeLista } from '../../components/IconesProvisorios';
import { ModalBase } from '../../components/ModalBase';
import { CalendarioMensal } from '../../components/CalendarioMensal';
import { TagMultiSelect } from '../../components/TagMultiSelect';
import { TagsChips } from '../../components/TagsChips';
import { useDialogos } from '../../components/Dialogo';
import { useToast } from '../../components/Toast';
import { mensagemDeErro } from '../../lib/erros';
import { formatarData, hojeIso } from '../../lib/datas';
import { dataPrevistaDaTarefa, entradaAtrasada, tarefaAtrasada, ultimaEntrada } from '../../lib/historicoTarefa';
import { FILTROS_VAZIOS, filtrarTarefas, haFiltroAtivo, periodosDasTarefas, rotuloPeriodo, type FiltrosManutencao, type StatusTarefa } from '../../lib/filtrosManutencao';
import { ocorrenciasNoIntervalo, proximaExecucao } from '../../lib/manutencao';
import { useTagsItens } from '../../hooks/useTagsItens';
import { useDefinirClassificacoesTarefa, useTodasTarefaClassificacoes } from '../../hooks/useTarefaClassificacoes';
import { useHistoricoTarefas, useRegistrarExecucaoTarefa } from '../../hooks/useTarefasHistorico';
import {
  useAtualizarTarefaManutencao,
  useCriarTarefaManutencao,
  useExcluirTarefaManutencao,
  useTarefasManutencao,
  type DadosTarefaManutencao,
} from '../../hooks/useTarefasManutencao';
import type { BaseProximaExecucao, HistoricoTarefa, TarefaManutencao } from '../../types';
import { EscolhaBaseModal } from './EscolhaBaseModal';
import { HistoricoTarefaModal } from './HistoricoTarefaModal';
import { CHAVE_SEM_COMODO, ManutencaoKanban, type AgrupamentoKanban } from './ManutencaoKanban';

const TAREFA_VAZIA: DadosTarefaManutencao = { nome: '', frequencia_dias: 30, ativo: true };

const PRESETS_FREQUENCIA = [1, 7, 15, 30, 60, 90, 120, 180, 365, 730].map((dias) => ({ label: rotuloPeriodo(dias), dias }));

function FormularioTarefa({
  inicial,
  classificacoesIniciais,
  todasClassificacoes,
  onSalvar,
  onCancelar,
}: {
  inicial: DadosTarefaManutencao;
  classificacoesIniciais: string[];
  todasClassificacoes: { id: string; nome: string }[];
  onSalvar: (dados: DadosTarefaManutencao, classificacaoIds: string[]) => Promise<void>;
  onCancelar: () => void;
}) {
  const [dados, setDados] = useState<DadosTarefaManutencao>(inicial);
  const [classificacaoIds, setClassificacaoIds] = useState<string[]>(classificacoesIniciais);
  const [salvando, setSalvando] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSalvando(true);
    try {
      await onSalvar(dados, classificacaoIds);
    } finally {
      setSalvando(false);
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      <label>
        Nome
        <input type="text" value={dados.nome} onChange={(e) => setDados({ ...dados, nome: e.target.value })} data-autofocus required />
      </label>
      <label>
        Cômodos
        <TagMultiSelect todasTags={todasClassificacoes} selecionadas={classificacaoIds} onChange={setClassificacaoIds} />
      </label>
      <label>
        Frequência
        <select
          value={PRESETS_FREQUENCIA.some((p) => p.dias === dados.frequencia_dias) ? dados.frequencia_dias : 'custom'}
          onChange={(e) => {
            if (e.target.value !== 'custom') setDados({ ...dados, frequencia_dias: Number(e.target.value) });
          }}
        >
          {PRESETS_FREQUENCIA.map((p) => (
            <option key={p.dias} value={p.dias}>
              {p.label}
            </option>
          ))}
          <option value="custom">Personalizado…</option>
        </select>
      </label>
      {!PRESETS_FREQUENCIA.some((p) => p.dias === dados.frequencia_dias) && (
        <label>
          A cada quantos dias
          <input
            type="number"
            min={1}
            value={dados.frequencia_dias}
            onChange={(e) => setDados({ ...dados, frequencia_dias: Number(e.target.value) || 1 })}
          />
        </label>
      )}
      <label>
        <input type="checkbox" checked={dados.ativo} onChange={(e) => setDados({ ...dados, ativo: e.target.checked })} />
        Ativa
      </label>
      <div className="modal-acoes">
        <button type="submit" disabled={salvando}>
          {salvando ? 'Salvando…' : 'Salvar'}
        </button>
        <button type="button" onClick={onCancelar}>
          Cancelar
        </button>
      </div>
    </form>
  );
}

export function ManutencaoPage() {
  const { data: tarefas, isLoading } = useTarefasManutencao();
  const { data: tags } = useTagsItens();
  const { data: historico } = useHistoricoTarefas();
  const { data: tarefaClassificacoes } = useTodasTarefaClassificacoes();
  const criar = useCriarTarefaManutencao();
  const atualizar = useAtualizarTarefaManutencao();
  const excluir = useExcluirTarefaManutencao();
  const registrarExecucao = useRegistrarExecucaoTarefa();
  const definirClassificacoes = useDefinirClassificacoesTarefa();
  const { confirmar } = useDialogos();
  const { mostrarToast } = useToast();

  const [modalAberto, setModalAberto] = useState(false);
  const [editando, setEditando] = useState<TarefaManutencao | null>(null);
  const [filtros, setFiltros] = useState<FiltrosManutencao>(FILTROS_VAZIOS);
  const [visao, setVisao] = useState<'lista' | 'kanban'>('lista');
  const [agrupamento, setAgrupamento] = useState<AgrupamentoKanban>('comodo');
  const [escolhaBase, setEscolhaBase] = useState<{ tarefa: TarefaManutencao; dataPrevista: string } | null>(null);
  const [historicoDe, setHistoricoDe] = useState<TarefaManutencao | null>(null);
  const [params, setParams] = useSearchParams();
  const hojeDia = hojeIso();
  const hoje = new Date();
  const [mesCalendario, setMesCalendario] = useState({ ano: hoje.getFullYear(), mes: hoje.getMonth() + 1 });

  const comodosPorTarefa = useMemo(() => tarefaClassificacoes ?? new Map(), [tarefaClassificacoes]);
  const periodos = useMemo(() => periodosDasTarefas(tarefas ?? []), [tarefas]);

  // O contador de atrasadas do cabeçalho leva pra cá já com o filtro ligado.
  useEffect(() => {
    if (params.get('filtro') === 'atrasadas') {
      setFiltros({ ...FILTROS_VAZIOS, status: ['atrasada'] });
      setParams({}, { replace: true });
    }
  }, [params, setParams]);

  const entradasPorTarefa = useMemo(() => {
    const mapa = new Map<string, HistoricoTarefa[]>();
    for (const entrada of historico ?? []) mapa.set(entrada.tarefa_id, [...(mapa.get(entrada.tarefa_id) ?? []), entrada]);
    return mapa;
  }, [historico]);

  /** Tarefa -> última execução, só das que foram feitas com atraso. */
  const atrasoPorTarefa = useMemo(() => {
    const mapa = new Map<string, HistoricoTarefa>();
    for (const [tarefaId, entradas] of entradasPorTarefa) {
      const ultima = ultimaEntrada(entradas);
      if (ultima && entradaAtrasada(ultima)) mapa.set(tarefaId, ultima);
    }
    return mapa;
  }, [entradasPorTarefa]);
  const tarefasFiltradas = useMemo(
    () => filtrarTarefas(tarefas ?? [], comodosPorTarefa, filtros, hojeDia),
    [tarefas, comodosPorTarefa, filtros, hojeDia]
  );

  function alternarNaLista<T>(lista: T[], valor: T): T[] {
    return lista.includes(valor) ? lista.filter((v) => v !== valor) : [...lista, valor];
  }

  const eventosCalendario = useMemo(() => {
    const inicio = `${mesCalendario.ano}-${String(mesCalendario.mes).padStart(2, '0')}-01`;
    const fim = `${mesCalendario.ano}-${String(mesCalendario.mes).padStart(2, '0')}-31`;
    const eventos: { data: string; rotulo: string }[] = [];
    for (const tarefa of tarefasFiltradas.filter((t) => t.ativo)) {
      for (const data of ocorrenciasNoIntervalo(tarefa, inicio, fim)) {
        eventos.push({ data, rotulo: tarefa.nome });
      }
    }
    return eventos;
  }, [tarefasFiltradas, mesCalendario]);

  function abrirNova() {
    setEditando(null);
    setModalAberto(true);
  }

  function abrirEdicao(tarefa: TarefaManutencao) {
    setEditando(tarefa);
    setModalAberto(true);
  }

  async function salvar(dados: DadosTarefaManutencao, tagIds: string[]) {
    try {
      const tarefaId = editando ? editando.id : (await criar.mutateAsync(dados)).id;
      if (editando) await atualizar.mutateAsync({ id: editando.id, dados });
      await definirClassificacoes.mutateAsync({ tarefaId, tagIds });
      setModalAberto(false);
      mostrarToast('Tarefa salva.');
    } catch (err) {
      mostrarToast(mensagemDeErro(err), 'erro');
    }
  }

  async function tratarExcluir(tarefa: TarefaManutencao) {
    const ok = await confirmar({ titulo: `Excluir "${tarefa.nome}"?`, mensagem: 'O histórico dessa tarefa também será excluído.', confirmarRotulo: 'Excluir', perigoso: true });
    if (!ok) return;
    try {
      await excluir.mutateAsync(tarefa.id);
      mostrarToast('Tarefa excluída.');
    } catch (err) {
      mostrarToast(mensagemDeErro(err), 'erro');
    }
  }

  async function registrarFeita(tarefa: TarefaManutencao, base: BaseProximaExecucao, dataPrevista: string | null) {
    try {
      await registrarExecucao.mutateAsync({ tarefaId: tarefa.id, dataExecucao: hojeDia, dataPrevista, base });
      mostrarToast('Marcada como feita hoje.');
    } catch (err) {
      mostrarToast(mensagemDeErro(err), 'erro');
    }
  }

  /** Atrasada: pergunta de onde conta a próxima. Em dia: grava direto. */
  function tratarMarcarFeita(tarefa: TarefaManutencao) {
    if ((entradasPorTarefa.get(tarefa.id) ?? []).some((e) => e.data_execucao === hojeDia)) {
      mostrarToast('Esta tarefa já foi marcada como feita hoje.', 'info');
      return;
    }
    const prevista = dataPrevistaDaTarefa(tarefa);
    if (prevista && tarefaAtrasada(tarefa, hojeDia)) setEscolhaBase({ tarefa, dataPrevista: prevista });
    else void registrarFeita(tarefa, 'execucao', prevista);
  }

  /** Arrastou o cartão do kanban: troca o cômodo (por cômodo) ou a frequência (por período). */
  async function moverTarefa(tarefa: TarefaManutencao, origem: string, destino: string) {
    try {
      if (agrupamento === 'periodo') {
        const dias = Number(destino.replace('periodo-', ''));
        await atualizar.mutateAsync({ id: tarefa.id, dados: { nome: tarefa.nome, frequencia_dias: dias, ativo: tarefa.ativo } });
        mostrarToast(`Tarefa movida para ${rotuloPeriodo(dias)}.`);
        return;
      }
      const atuais = (comodosPorTarefa.get(tarefa.id) ?? []).map((c: { id: string }) => c.id).filter((id: string) => id !== origem);
      const tagIds = destino === CHAVE_SEM_COMODO || atuais.includes(destino) ? atuais : [...atuais, destino];
      await definirClassificacoes.mutateAsync({ tarefaId: tarefa.id, tagIds });
      mostrarToast(`Tarefa movida para ${destino === CHAVE_SEM_COMODO ? 'Sem cômodo' : (tags ?? []).find((t) => t.id === destino)?.nome}.`);
    } catch (err) {
      mostrarToast(mensagemDeErro(err), 'erro');
    }
  }

  function mudarMes(delta: number) {
    setMesCalendario((atual) => {
      const data = new Date(atual.ano, atual.mes - 1 + delta, 1);
      return { ano: data.getFullYear(), mes: data.getMonth() + 1 };
    });
  }

  return (
    <div className="settings-secao">
      <div className="manutencao-titulo-linha">
        <h2>Manutenção</h2>
        <div className="manutencao-visoes">
          <button
            type="button"
            className={`btn-icone${visao === 'lista' ? ' documentos-modo-ativo' : ''}`}
            aria-pressed={visao === 'lista'}
            onClick={() => setVisao('lista')}
            title="Visualização em lista"
            aria-label="Visualização em lista"
          >
            <IconeLista />
          </button>
          <button
            type="button"
            className={`btn-icone${visao === 'kanban' ? ' documentos-modo-ativo' : ''}`}
            aria-pressed={visao === 'kanban'}
            onClick={() => setVisao('kanban')}
            title="Visualização em kanban"
            aria-label="Visualização em kanban"
          >
            <IconeKanban />
          </button>
        </div>
      </div>

      <div className="apartamento-barra">
        <input
          type="search"
          className="manutencao-busca"
          value={filtros.busca}
          onChange={(e) => setFiltros({ ...filtros, busca: e.target.value })}
          placeholder="Buscar tarefa…"
          aria-label="Buscar tarefa"
        />
        <button type="button" onClick={abrirNova}>
          + Tarefa
        </button>
        <BotaoExportarCsv
          nome="Tarefas de manutenção"
          linhas={tarefasFiltradas}
          colunas={[
            { titulo: 'Nome', valor: (t: TarefaManutencao) => t.nome },
            { titulo: 'Frequência (dias)', valor: (t: TarefaManutencao) => t.frequencia_dias },
            { titulo: 'Última execução', valor: (t: TarefaManutencao) => (t.ultima_execucao ? formatarData(t.ultima_execucao) : null) },
            { titulo: 'Próxima execução', valor: (t: TarefaManutencao) => formatarData(proximaExecucao(t)) },
            { titulo: 'Ativa', valor: (t: TarefaManutencao) => t.ativo },
            { titulo: 'Classificações', valor: (t: TarefaManutencao) => (tarefaClassificacoes?.get(t.id) ?? []).map((c) => c.nome).join(' | ') },
          ]}
        />
      </div>

      <div className="manutencao-filtros">
        <div className="manutencao-grupo-filtro" role="group" aria-label="Filtrar por cômodo">
          {(tags ?? []).map((c) => (
            <button
              key={c.id}
              type="button"
              className={filtros.comodoIds.includes(c.id) ? 'tag-opcao tag-opcao-ativa' : 'tag-opcao'}
              aria-pressed={filtros.comodoIds.includes(c.id)}
              onClick={() => setFiltros({ ...filtros, comodoIds: alternarNaLista(filtros.comodoIds, c.id) })}
            >
              {c.nome}
            </button>
          ))}
        </div>
        <div className="manutencao-grupo-filtro" role="group" aria-label="Filtrar por período">
          {periodos.map((dias) => (
            <button
              key={dias}
              type="button"
              className={filtros.periodos.includes(dias) ? 'tag-opcao tag-opcao-ativa' : 'tag-opcao'}
              aria-pressed={filtros.periodos.includes(dias)}
              onClick={() => setFiltros({ ...filtros, periodos: alternarNaLista(filtros.periodos, dias) })}
            >
              {rotuloPeriodo(dias)}
            </button>
          ))}
        </div>
        <div className="manutencao-grupo-filtro" role="group" aria-label="Filtrar por situação">
          {([['feita', 'Feitas'], ['nao_feita', 'Não feitas'], ['atrasada', 'Atrasadas']] as [StatusTarefa, string][]).map(([valor, rotulo]) => (
            <button
              key={valor}
              type="button"
              className={filtros.status.includes(valor) ? 'tag-opcao tag-opcao-ativa' : 'tag-opcao'}
              aria-pressed={filtros.status.includes(valor)}
              onClick={() => setFiltros({ ...filtros, status: alternarNaLista(filtros.status, valor) })}
            >
              {rotulo}
            </button>
          ))}
          {haFiltroAtivo(filtros) && (
            <button type="button" className="tag-opcao" onClick={() => setFiltros(FILTROS_VAZIOS)}>
              Limpar filtros
            </button>
          )}
        </div>
      </div>

      {visao === 'kanban' && (
        <div className="manutencao-grupo-filtro" role="group" aria-label="Agrupar o kanban">
          {([['comodo', 'Por cômodo'], ['periodo', 'Por período']] as [AgrupamentoKanban, string][]).map(([valor, rotulo]) => (
            <button
              key={valor}
              type="button"
              className={agrupamento === valor ? 'tag-opcao tag-opcao-ativa' : 'tag-opcao'}
              aria-pressed={agrupamento === valor}
              onClick={() => setAgrupamento(valor)}
            >
              {rotulo}
            </button>
          ))}
        </div>
      )}

      {isLoading ? (
        <p>Carregando…</p>
      ) : tarefasFiltradas.length === 0 ? (
        <p className="hierarquia-vazio">{tarefas?.length === 0 ? 'Nenhuma tarefa cadastrada ainda.' : 'Nenhuma tarefa com esses filtros.'}</p>
      ) : visao === 'kanban' ? (
        <ManutencaoKanban
          tarefas={tarefasFiltradas}
          comodos={tags ?? []}
          atrasoPorTarefa={atrasoPorTarefa}
          comodosPorTarefa={comodosPorTarefa}
          agrupamento={agrupamento}
          onFeita={tratarMarcarFeita}
          onEditar={abrirEdicao}
          onHistorico={setHistoricoDe}
          onMover={moverTarefa}
        />
      ) : (
        <ul className="lista-contas">
          {tarefasFiltradas.map((tarefa) => (
            <li key={tarefa.id} className={tarefa.ativo ? '' : 'conta-inativa'}>
              <div>
                <strong>{tarefa.nome}</strong>
                <span className="conta-detalhe">
                  <TagsChips tags={tarefaClassificacoes?.get(tarefa.id)} /> · {rotuloPeriodo(tarefa.frequencia_dias)} · próxima em {formatarData(proximaExecucao(tarefa))}
                </span>
                {atrasoPorTarefa.get(tarefa.id)?.data_prevista && (
                  <span className="manutencao-flag-atraso" title={`Feita com atraso em ${formatarData(atrasoPorTarefa.get(tarefa.id)?.data_execucao ?? '')}`}>
                    <IconeBandeira /> Feita com atraso (devia ser {formatarData(atrasoPorTarefa.get(tarefa.id)?.data_prevista ?? '')})
                  </span>
                )}
              </div>
              <div className="hierarquia-item-acoes">
                <button type="button" onClick={() => tratarMarcarFeita(tarefa)}>
                  Feita hoje
                </button>
                <button type="button" onClick={() => setHistoricoDe(tarefa)} title={`Histórico de ${tarefa.nome}`} aria-label={`Histórico de ${tarefa.nome}`}>
                  Histórico
                </button>
                <button type="button" className="btn-icone" onClick={() => abrirEdicao(tarefa)} title={`Editar ${tarefa.nome}`} aria-label={`Editar ${tarefa.nome}`}>
                  <IconeFuncao funcao="editar" />
                </button>
                <button type="button" className="btn-icone btn-icone-perigo" onClick={() => tratarExcluir(tarefa)} title={`Excluir ${tarefa.nome}`} aria-label={`Excluir ${tarefa.nome}`}>
                  <IconeFuncao funcao="excluir" />
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <div className="calendario-cabecalho-mes">
        <button type="button" onClick={() => mudarMes(-1)} aria-label="Mês anterior">
          ‹
        </button>
        <strong>
          {mesCalendario.mes.toString().padStart(2, '0')}/{mesCalendario.ano}
        </strong>
        <button type="button" onClick={() => mudarMes(1)} aria-label="Próximo mês">
          ›
        </button>
      </div>
      <CalendarioMensal ano={mesCalendario.ano} mes={mesCalendario.mes} eventos={eventosCalendario} />

      {escolhaBase && (
        <EscolhaBaseModal
          tarefa={escolhaBase.tarefa}
          dataPrevista={escolhaBase.dataPrevista}
          hoje={hojeDia}
          onCancelar={() => setEscolhaBase(null)}
          onConfirmar={(base) => {
            const { tarefa, dataPrevista } = escolhaBase;
            setEscolhaBase(null);
            void registrarFeita(tarefa, base, dataPrevista);
          }}
        />
      )}

      {historicoDe && (
        <HistoricoTarefaModal
          tarefa={tarefas?.find((t) => t.id === historicoDe.id) ?? historicoDe}
          entradas={entradasPorTarefa.get(historicoDe.id) ?? []}
          hoje={hojeDia}
          onFechar={() => setHistoricoDe(null)}
        />
      )}

      <ModalBase aberto={modalAberto} rotulo={editando ? 'Editar tarefa' : 'Nova tarefa'} onFechar={() => setModalAberto(false)} classe="modal-edicao">
        <h3 className="modal-titulo">{editando ? 'Editar tarefa' : 'Nova tarefa'}</h3>
        <FormularioTarefa
          inicial={editando ? { nome: editando.nome, frequencia_dias: editando.frequencia_dias, ativo: editando.ativo } : TAREFA_VAZIA}
          classificacoesIniciais={editando ? (tarefaClassificacoes?.get(editando.id) ?? []).map((c) => c.id) : []}
          todasClassificacoes={tags ?? []}
          onSalvar={salvar}
          onCancelar={() => setModalAberto(false)}
        />
      </ModalBase>
    </div>
  );
}
