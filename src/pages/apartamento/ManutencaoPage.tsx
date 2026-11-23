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
import { aceitaDiaDaSemana, alternarDia, DIAS_DA_SEMANA, resumoDosDias, ROTULOS_DIA, ROTULOS_DIA_CURTO } from '../../lib/diasSemana';
import { dataPrevistaDaTarefa, entradaAtrasada, tarefaAtrasada, ultimaEntrada } from '../../lib/historicoTarefa';
import { FILTROS_VAZIOS, filtrarTarefas, haFiltroAtivo, periodosDasTarefas, rotuloPeriodo, type FiltrosManutencao, type StatusTarefa } from '../../lib/filtrosManutencao';
import { ocorrenciasNoIntervalo, proximaExecucao } from '../../lib/manutencao';
import { useTagsItens } from '../../hooks/useTagsItens';
import { useDefinirClassificacoesTarefa, useTodasTarefaClassificacoes } from '../../hooks/useTarefaClassificacoes';
import { useHistoricoPessoas, useHistoricoTarefas, useRegistrarExecucaoTarefa } from '../../hooks/useTarefasHistorico';
import { useCasalMembros, useDocumentosPessoas } from '../../hooks/useDocumentos';
import { usePessoaLogada } from '../../hooks/usePessoaLogada';
import { chaveDoResponsavel, membrosPorCasal, opcoesDeResponsavel, pessoasIndividuais, pessoasPadraoDaExecucao, responsavelDaColuna, SEM_RESPONSAVEL, textoDoResponsavel, casais } from '../../lib/responsaveis';
import {
  useAtualizarTarefaManutencao,
  useCriarTarefaManutencao,
  useExcluirTarefaManutencao,
  useTarefasManutencao,
  type DadosTarefaManutencao,
} from '../../hooks/useTarefasManutencao';
import type { BaseProximaExecucao, HistoricoTarefa, PessoaDocumentos, TarefaManutencao } from '../../types';
import { FeitaHojeModal } from './FeitaHojeModal';
import { ExportarPlanilhaModal } from './ExportarPlanilhaModal';
import { HistoricoTarefaModal } from './HistoricoTarefaModal';
import { CHAVE_SEM_COMODO, CHAVE_SEM_DIA, ManutencaoKanban, PREFIXO_DIA, type AgrupamentoKanban } from './ManutencaoKanban';

const TAREFA_VAZIA: DadosTarefaManutencao = { nome: '', frequencia_dias: 30, ativo: true, dias_semana: [], instrucoes: null, ...SEM_RESPONSAVEL };

function dadosDaTarefa(t: TarefaManutencao): DadosTarefaManutencao {
  return {
    nome: t.nome,
    frequencia_dias: t.frequencia_dias,
    ativo: t.ativo,
    dias_semana: t.dias_semana,
    instrucoes: t.instrucoes,
    responsavel_tipo: t.responsavel_tipo,
    responsavel_pessoa_id: t.responsavel_pessoa_id,
    responsavel_casal_id: t.responsavel_casal_id,
  };
}

const PRESETS_FREQUENCIA = [1, 7, 15, 30, 60, 90, 120, 180, 365, 730].map((dias) => ({ label: rotuloPeriodo(dias), dias }));

function FormularioTarefa({
  inicial,
  classificacoesIniciais,
  todasClassificacoes,
  pessoas,
  onSalvar,
  onCancelar,
}: {
  inicial: DadosTarefaManutencao;
  pessoas: PessoaDocumentos[];
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
      const dadosFinais = { ...dados, dias_semana: aceitaDiaDaSemana(dados.frequencia_dias) ? dados.dias_semana : [], instrucoes: dados.instrucoes?.trim() || null };
      await onSalvar(dadosFinais, classificacaoIds);
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
        Responsável
        <select
          value={chaveDoResponsavel(dados)}
          onChange={(e) => {
            const opcao = opcoesDeResponsavel(pessoas).find((o) => o.chave === e.target.value);
            if (opcao) setDados({ ...dados, responsavel_tipo: opcao.responsavel_tipo, responsavel_pessoa_id: opcao.responsavel_pessoa_id, responsavel_casal_id: opcao.responsavel_casal_id });
          }}
        >
          {opcoesDeResponsavel(pessoas).map((o) => (
            <option key={o.chave} value={o.chave}>
              {o.rotulo}
            </option>
          ))}
        </select>
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
      {aceitaDiaDaSemana(dados.frequencia_dias) && (
        <div className="manutencao-form-dias">
          <span>Dias da semana</span>
          <div className="manutencao-grupo-filtro" role="group" aria-label="Dias da semana da tarefa">
            {DIAS_DA_SEMANA.map((dia) => (
              <button
                key={dia}
                type="button"
                className={dados.dias_semana.includes(dia) ? 'tag-opcao tag-opcao-ativa' : 'tag-opcao'}
                aria-pressed={dados.dias_semana.includes(dia)}
                aria-label={ROTULOS_DIA[dia]}
                onClick={() => setDados({ ...dados, dias_semana: alternarDia(dados.dias_semana, dia) })}
              >
                {ROTULOS_DIA_CURTO[dia]}
              </button>
            ))}
          </div>
        </div>
      )}
      <label>
        Instruções
        <textarea value={dados.instrucoes ?? ''} onChange={(e) => setDados({ ...dados, instrucoes: e.target.value })} rows={3} />
      </label>
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
  const { data: historicoPessoas } = useHistoricoPessoas();
  const { data: pessoas } = useDocumentosPessoas();
  const { data: casalMembros } = useCasalMembros();
  const pessoaLogada = usePessoaLogada();
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
  const [instrucoesAbertas, setInstrucoesAbertas] = useState<Set<string>>(new Set());
  const [exportarAberto, setExportarAberto] = useState(false);
  const [feitaHoje, setFeitaHoje] = useState<{ tarefa: TarefaManutencao; dataPrevistaAtrasada: string | null } | null>(null);
  const [historicoDe, setHistoricoDe] = useState<TarefaManutencao | null>(null);
  const [params, setParams] = useSearchParams();
  const hojeDia = hojeIso();
  const hoje = new Date();
  const [mesCalendario, setMesCalendario] = useState({ ano: hoje.getFullYear(), mes: hoje.getMonth() + 1 });

  const comodosPorTarefa = useMemo(() => tarefaClassificacoes ?? new Map(), [tarefaClassificacoes]);
  const listaPessoas = useMemo(() => pessoas ?? [], [pessoas]);
  const individuais = useMemo(() => pessoasIndividuais(listaPessoas), [listaPessoas]);
  const membrosDosCasais = useMemo(() => membrosPorCasal(casalMembros ?? []), [casalMembros]);
  const nomePorPessoa = useMemo(() => new Map(listaPessoas.map((p) => [p.id, p.nome])), [listaPessoas]);
  const primeiroCasalId = casais(listaPessoas)[0]?.id ?? null;
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

  /** Execução -> ids de quem fez. */
  const pessoasPorEntrada = useMemo(() => {
    const mapa = new Map<string, string[]>();
    for (const h of historicoPessoas ?? []) mapa.set(h.historico_id, [...(mapa.get(h.historico_id) ?? []), h.pessoa_id]);
    return mapa;
  }, [historicoPessoas]);

  const responsaveisParaExportar = useMemo(() => {
    const mapa = new Map<string, string>();
    for (const t of tarefas ?? []) {
      const texto = textoDoResponsavel(t, membrosDosCasais, nomePorPessoa);
      if (texto) mapa.set(t.id, texto);
    }
    return mapa;
  }, [tarefas, membrosDosCasais, nomePorPessoa]);

  const feitaPorParaExportar = useMemo(() => {
    const mapa = new Map<string, string>();
    for (const [tarefaId, entradas] of entradasPorTarefa) {
      const ultima = ultimaEntrada(entradas);
      const nomes = (ultima ? (pessoasPorEntrada.get(ultima.id) ?? []) : []).map((id) => nomePorPessoa.get(id)).filter((n): n is string => !!n);
      if (nomes.length > 0) mapa.set(tarefaId, nomes.join(' e '));
    }
    return mapa;
  }, [entradasPorTarefa, pessoasPorEntrada, nomePorPessoa]);

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
    () => filtrarTarefas(tarefas ?? [], comodosPorTarefa, filtros, hojeDia, membrosDosCasais),
    [tarefas, comodosPorTarefa, filtros, hojeDia, membrosDosCasais]
  );

  function alternarInstrucoes(id: string) {
    setInstrucoesAbertas((atual) => {
      const novo = new Set(atual);
      if (novo.has(id)) novo.delete(id);
      else novo.add(id);
      return novo;
    });
  }

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

  async function registrarFeita(tarefa: TarefaManutencao, base: BaseProximaExecucao, dataPrevista: string | null, pessoaIds: string[]) {
    try {
      const resultado = await registrarExecucao.mutateAsync({ tarefaId: tarefa.id, dataExecucao: hojeDia, dataPrevista, base, pessoaIds });
      mostrarToast(resultado === 'enfileirada' ? 'Marcada como feita hoje. Será enviada quando houver internet.' : 'Marcada como feita hoje.');
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
    setFeitaHoje({ tarefa, dataPrevistaAtrasada: prevista && tarefaAtrasada(tarefa, hojeDia) ? prevista : null });
  }

  /** Arrastou o cartão do kanban: troca o cômodo (por cômodo) ou a frequência (por período). */
  async function moverTarefa(tarefa: TarefaManutencao, origem: string, destino: string) {
    try {
      if (agrupamento === 'periodo') {
        const dias = Number(destino.replace('periodo-', ''));
        await atualizar.mutateAsync({ id: tarefa.id, dados: { ...dadosDaTarefa(tarefa), frequencia_dias: dias, dias_semana: aceitaDiaDaSemana(dias) ? tarefa.dias_semana : [] } });
        mostrarToast(`Tarefa movida para ${rotuloPeriodo(dias)}.`);
        return;
      }
      if (agrupamento === 'pessoa') {
        const novo = responsavelDaColuna(destino, primeiroCasalId);
        if (!novo) {
          mostrarToast('Cadastre um casal em Documentos > Pessoais para usar "Qualquer um" e "Juntos".', 'erro');
          return;
        }
        await atualizar.mutateAsync({ id: tarefa.id, dados: { ...dadosDaTarefa(tarefa), ...novo } });
        mostrarToast(`Tarefa movida para ${destino === 'sem' ? 'Sem responsável' : destino === 'qualquer' ? 'Qualquer um' : destino === 'juntos' ? 'Juntos' : (nomePorPessoa.get(destino.slice('pessoa:'.length)) ?? 'a pessoa')}.`);
        return;
      }
      if (agrupamento === 'dia') {
        if (destino !== CHAVE_SEM_DIA && !aceitaDiaDaSemana(tarefa.frequencia_dias)) {
          mostrarToast('Só tarefas semanais podem ter dia da semana.', 'erro');
          return;
        }
        const restantes = tarefa.dias_semana.filter((d) => `${PREFIXO_DIA}${d}` !== origem);
        const dia = destino === CHAVE_SEM_DIA ? null : Number(destino.replace(PREFIXO_DIA, ''));
        const novos = dia === null || restantes.includes(dia) ? restantes : alternarDia(restantes, dia);
        await atualizar.mutateAsync({ id: tarefa.id, dados: { ...dadosDaTarefa(tarefa), dias_semana: novos } });
        mostrarToast(`Tarefa movida para ${dia === null ? 'Sem dia' : ROTULOS_DIA[dia]}.`);
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
        <button type="button" onClick={() => setExportarAberto(true)} disabled={!tarefas || tarefas.length === 0}>
          Exportar planilha
        </button>
        <BotaoExportarCsv
          nome="Tarefas de manutenção"
          linhas={tarefasFiltradas}
          colunas={[
            { titulo: 'Nome', valor: (t: TarefaManutencao) => t.nome },
            { titulo: 'Frequência (dias)', valor: (t: TarefaManutencao) => t.frequencia_dias },
            { titulo: 'Última execução', valor: (t: TarefaManutencao) => (t.ultima_execucao ? formatarData(t.ultima_execucao) : null) },
            { titulo: 'Próxima execução', valor: (t: TarefaManutencao) => formatarData(proximaExecucao(t)) },
            { titulo: 'Dias da semana', valor: (t: TarefaManutencao) => resumoDosDias(t.dias_semana) },
            { titulo: 'Instruções', valor: (t: TarefaManutencao) => t.instrucoes },
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
        <div className="manutencao-grupo-filtro" role="group" aria-label="Filtrar por responsável">
          {individuais.map((p) => (
            <button
              key={p.id}
              type="button"
              className={filtros.responsaveis.includes(p.id) ? 'tag-opcao tag-opcao-ativa' : 'tag-opcao'}
              aria-pressed={filtros.responsaveis.includes(p.id)}
              onClick={() => setFiltros({ ...filtros, responsaveis: alternarNaLista(filtros.responsaveis, p.id) })}
            >
              {p.nome}
            </button>
          ))}
          <button
            type="button"
            className={filtros.responsaveis.includes('nenhum') ? 'tag-opcao tag-opcao-ativa' : 'tag-opcao'}
            aria-pressed={filtros.responsaveis.includes('nenhum')}
            onClick={() => setFiltros({ ...filtros, responsaveis: alternarNaLista(filtros.responsaveis, 'nenhum') })}
          >
            Sem responsável
          </button>
        </div>
        <div className="manutencao-grupo-filtro" role="group" aria-label="Filtrar por dia da semana">
          {DIAS_DA_SEMANA.map((dia) => (
            <button
              key={dia}
              type="button"
              className={filtros.dias.includes(dia) ? 'tag-opcao tag-opcao-ativa' : 'tag-opcao'}
              aria-pressed={filtros.dias.includes(dia)}
              aria-label={ROTULOS_DIA[dia]}
              onClick={() => setFiltros({ ...filtros, dias: alternarNaLista(filtros.dias, dia) })}
            >
              {ROTULOS_DIA_CURTO[dia]}
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
          {([['comodo', 'Por cômodo'], ['periodo', 'Por período'], ['dia', 'Por dia da semana'], ['pessoa', 'Por pessoa']] as [AgrupamentoKanban, string][]).map(([valor, rotulo]) => (
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
          pessoas={individuais}
          membrosDosCasais={membrosDosCasais}
          nomePorPessoa={nomePorPessoa}
          temCasal={primeiroCasalId !== null}
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
                {tarefa.instrucoes ? (
                  <button type="button" className="manutencao-nome-botao" aria-expanded={instrucoesAbertas.has(tarefa.id)} onClick={() => alternarInstrucoes(tarefa.id)} title={instrucoesAbertas.has(tarefa.id) ? 'Ocultar instruções' : 'Mostrar instruções'}>
                    {tarefa.nome}
                  </button>
                ) : (
                  <strong>{tarefa.nome}</strong>
                )}
                {instrucoesAbertas.has(tarefa.id) && tarefa.instrucoes && <p className="manutencao-instrucoes">{tarefa.instrucoes}</p>}
                <span className="conta-detalhe">
                  <TagsChips tags={tarefaClassificacoes?.get(tarefa.id)} /> · {rotuloPeriodo(tarefa.frequencia_dias)}{tarefa.dias_semana.length > 0 ? ` (${resumoDosDias(tarefa.dias_semana)})` : ''} · próxima em {formatarData(proximaExecucao(tarefa))}
                </span>
                {textoDoResponsavel(tarefa, membrosDosCasais, nomePorPessoa) && <span className="tag-chip">{textoDoResponsavel(tarefa, membrosDosCasais, nomePorPessoa)}</span>}
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

      {exportarAberto && (
        <ExportarPlanilhaModal
          dados={{ tarefas: tarefasFiltradas, historico: historico ?? [], comodosPorTarefa, hoje: hojeDia, responsaveis: responsaveisParaExportar, feitaPorUltima: feitaPorParaExportar }}
          origem={haFiltroAtivo(filtros) ? 'as filtradas na tela' : 'todas'}
          onFechar={() => setExportarAberto(false)}
        />
      )}

      {feitaHoje && (
        <FeitaHojeModal
          tarefa={feitaHoje.tarefa}
          dataPrevistaAtrasada={feitaHoje.dataPrevistaAtrasada}
          hoje={hojeDia}
          pessoas={individuais}
          padrao={pessoasPadraoDaExecucao(feitaHoje.tarefa, membrosDosCasais, pessoaLogada?.id ?? null)}
          onCancelar={() => setFeitaHoje(null)}
          onConfirmar={({ base, pessoaIds }) => {
            const { tarefa } = feitaHoje;
            setFeitaHoje(null);
            void registrarFeita(tarefa, base, dataPrevistaDaTarefa(tarefa), pessoaIds);
          }}
        />
      )}

      {historicoDe && (
        <HistoricoTarefaModal
          tarefa={tarefas?.find((t) => t.id === historicoDe.id) ?? historicoDe}
          entradas={entradasPorTarefa.get(historicoDe.id) ?? []}
          pessoas={individuais}
          pessoasPorEntrada={pessoasPorEntrada}
          hoje={hojeDia}
          onFechar={() => setHistoricoDe(null)}
        />
      )}

      <ModalBase aberto={modalAberto} rotulo={editando ? 'Editar tarefa' : 'Nova tarefa'} onFechar={() => setModalAberto(false)} classe="modal-edicao">
        <h3 className="modal-titulo">{editando ? 'Editar tarefa' : 'Nova tarefa'}</h3>
        <FormularioTarefa
          inicial={editando ? dadosDaTarefa(editando) : TAREFA_VAZIA}
          classificacoesIniciais={editando ? (tarefaClassificacoes?.get(editando.id) ?? []).map((c) => c.id) : []}
          todasClassificacoes={tags ?? []}
          pessoas={listaPessoas}
          onSalvar={salvar}
          onCancelar={() => setModalAberto(false)}
        />
      </ModalBase>
    </div>
  );
}
