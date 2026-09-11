import { useMemo, useState, type FormEvent } from 'react';
import { ModalBase } from '../../components/ModalBase';
import { CalendarioMensal } from '../../components/CalendarioMensal';
import { useDialogos } from '../../components/Dialogo';
import { useToast } from '../../components/Toast';
import { mensagemDeErro } from '../../lib/erros';
import { formatarData } from '../../lib/datas';
import { ocorrenciasNoIntervalo, proximaExecucao } from '../../lib/manutencao';
import { useClassificacoesManutencao } from '../../hooks/useClassificacoesManutencao';
import {
  useAtualizarTarefaManutencao,
  useCriarTarefaManutencao,
  useExcluirTarefaManutencao,
  useRegistrarExecucaoTarefa,
  useTarefasManutencao,
  type DadosTarefaManutencao,
} from '../../hooks/useTarefasManutencao';
import type { TarefaManutencao } from '../../types';

const TAREFA_VAZIA: DadosTarefaManutencao = { nome: '', classificacao_id: null, frequencia_dias: 30, ativo: true };

const PRESETS_FREQUENCIA = [
  { label: 'Toda semana', dias: 7 },
  { label: 'A cada 15 dias', dias: 15 },
  { label: 'Todo mês', dias: 30 },
  { label: 'A cada 3 meses', dias: 90 },
  { label: 'A cada 6 meses', dias: 180 },
  { label: 'Todo ano', dias: 365 },
];

function FormularioTarefa({
  inicial,
  classificacoes,
  onSalvar,
  onCancelar,
}: {
  inicial: DadosTarefaManutencao;
  classificacoes: { id: string; nome: string }[];
  onSalvar: (dados: DadosTarefaManutencao) => Promise<void>;
  onCancelar: () => void;
}) {
  const [dados, setDados] = useState<DadosTarefaManutencao>(inicial);
  const [salvando, setSalvando] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSalvando(true);
    try {
      await onSalvar(dados);
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
        Classificação
        <select
          value={dados.classificacao_id ?? ''}
          onChange={(e) => setDados({ ...dados, classificacao_id: e.target.value || null })}
        >
          <option value="">Sem classificação</option>
          {classificacoes.map((c) => (
            <option key={c.id} value={c.id}>
              {c.nome}
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
  const { data: classificacoes } = useClassificacoesManutencao();
  const criar = useCriarTarefaManutencao();
  const atualizar = useAtualizarTarefaManutencao();
  const excluir = useExcluirTarefaManutencao();
  const registrarExecucao = useRegistrarExecucaoTarefa();
  const { confirmar } = useDialogos();
  const { mostrarToast } = useToast();

  const [modalAberto, setModalAberto] = useState(false);
  const [editando, setEditando] = useState<TarefaManutencao | null>(null);
  const hoje = new Date();
  const [mesCalendario, setMesCalendario] = useState({ ano: hoje.getFullYear(), mes: hoje.getMonth() + 1 });

  const classificacaoPorId = useMemo(() => new Map((classificacoes ?? []).map((c) => [c.id, c.nome])), [classificacoes]);

  const eventosCalendario = useMemo(() => {
    const inicio = `${mesCalendario.ano}-${String(mesCalendario.mes).padStart(2, '0')}-01`;
    const fim = `${mesCalendario.ano}-${String(mesCalendario.mes).padStart(2, '0')}-31`;
    const eventos: { data: string; rotulo: string }[] = [];
    for (const tarefa of (tarefas ?? []).filter((t) => t.ativo)) {
      for (const data of ocorrenciasNoIntervalo(tarefa, inicio, fim)) {
        eventos.push({ data, rotulo: tarefa.nome });
      }
    }
    return eventos;
  }, [tarefas, mesCalendario]);

  function abrirNova() {
    setEditando(null);
    setModalAberto(true);
  }

  function abrirEdicao(tarefa: TarefaManutencao) {
    setEditando(tarefa);
    setModalAberto(true);
  }

  async function salvar(dados: DadosTarefaManutencao) {
    try {
      if (editando) {
        await atualizar.mutateAsync({ id: editando.id, dados });
      } else {
        await criar.mutateAsync(dados);
      }
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

  async function tratarMarcarFeita(tarefa: TarefaManutencao) {
    try {
      await registrarExecucao.mutateAsync({ tarefaId: tarefa.id });
      mostrarToast('Marcada como feita hoje.');
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
      <h2>Manutenção</h2>
      <button type="button" onClick={abrirNova}>
        + Tarefa
      </button>

      {isLoading ? (
        <p>Carregando…</p>
      ) : (
        <ul className="lista-contas">
          {(tarefas ?? []).map((tarefa) => (
            <li key={tarefa.id} className={tarefa.ativo ? '' : 'conta-inativa'}>
              <div>
                <strong>{tarefa.nome}</strong>
                <span className="conta-detalhe">
                  {tarefa.classificacao_id ? `${classificacaoPorId.get(tarefa.classificacao_id) ?? ''} · ` : ''}
                  próxima em {formatarData(proximaExecucao(tarefa))}
                </span>
              </div>
              <div className="hierarquia-item-acoes">
                <button type="button" onClick={() => tratarMarcarFeita(tarefa)}>
                  Feita hoje
                </button>
                <button type="button" className="btn-icone" onClick={() => abrirEdicao(tarefa)} aria-label="Editar">
                  ✎
                </button>
                <button type="button" className="btn-icone btn-icone-perigo" onClick={() => tratarExcluir(tarefa)} aria-label="Excluir">
                  🗑
                </button>
              </div>
            </li>
          ))}
          {tarefas?.length === 0 && <p className="hierarquia-vazio">Nenhuma tarefa cadastrada ainda.</p>}
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

      <ModalBase aberto={modalAberto} rotulo={editando ? 'Editar tarefa' : 'Nova tarefa'} onFechar={() => setModalAberto(false)} classe="modal-edicao">
        <h3 className="modal-titulo">{editando ? 'Editar tarefa' : 'Nova tarefa'}</h3>
        <FormularioTarefa
          inicial={
            editando
              ? { nome: editando.nome, classificacao_id: editando.classificacao_id, frequencia_dias: editando.frequencia_dias, ativo: editando.ativo }
              : TAREFA_VAZIA
          }
          classificacoes={classificacoes ?? []}
          onSalvar={salvar}
          onCancelar={() => setModalAberto(false)}
        />
      </ModalBase>
    </div>
  );
}
