import type { ReactNode } from 'react';
import { DndContext, PointerSensor, pointerWithin, useDraggable, useDroppable, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import { IconeFuncao } from '../../components/IconeUso';
import { IconeBandeira } from '../../components/IconesProvisorios';
import { TagsChips } from '../../components/TagsChips';
import { formatarData } from '../../lib/datas';
import { rotuloPeriodo } from '../../lib/filtrosManutencao';
import { proximaExecucao } from '../../lib/manutencao';
import type { HistoricoTarefa, TagItem, TarefaManutencao } from '../../types';

export type AgrupamentoKanban = 'comodo' | 'periodo';

export const CHAVE_SEM_COMODO = 'sem-comodo';
const PREFIXO_COLUNA = 'coluna:';
const SEPARADOR = '@';

export interface Coluna {
  chave: string;
  titulo: string;
  tarefas: TarefaManutencao[];
}

/** Uma coluna por cômodo (todas, mesmo vazias, pra dar pra soltar nelas) e uma para as sem cômodo; tarefa com vários cômodos aparece em cada um. */
export function colunasPorComodo(tarefas: TarefaManutencao[], comodos: TagItem[], comodosPorTarefa: Map<string, TagItem[]>): Coluna[] {
  const colunas: Coluna[] = comodos.map((c) => ({ chave: c.id, titulo: c.nome, tarefas: [] }));
  const porId = new Map(colunas.map((c) => [c.chave, c]));
  const semComodo: Coluna = { chave: CHAVE_SEM_COMODO, titulo: 'Sem cômodo', tarefas: [] };
  for (const tarefa of tarefas) {
    const dela = comodosPorTarefa.get(tarefa.id) ?? [];
    const colunasDela = dela.map((c) => porId.get(c.id)).filter((c): c is Coluna => !!c);
    if (colunasDela.length === 0) semComodo.tarefas.push(tarefa);
    for (const coluna of colunasDela) coluna.tarefas.push(tarefa);
  }
  return [...colunas, semComodo];
}

/** Uma coluna por período (frequência da tarefa), do mais curto ao mais longo; dentro dela, pela próxima execução. */
export function colunasPorPeriodo(tarefas: TarefaManutencao[]): Coluna[] {
  const porDias = new Map<number, TarefaManutencao[]>();
  for (const tarefa of tarefas) porDias.set(tarefa.frequencia_dias, [...(porDias.get(tarefa.frequencia_dias) ?? []), tarefa]);
  return [...porDias.entries()]
    .sort(([a], [b]) => a - b)
    .map(([dias, lista]) => ({
      chave: `periodo-${dias}`,
      titulo: rotuloPeriodo(dias),
      tarefas: lista.sort((a, b) => proximaExecucao(a).localeCompare(proximaExecucao(b)) || a.nome.localeCompare(b.nome, 'pt-BR')),
    }));
}

interface CartaoProps {
  tarefa: TarefaManutencao;
  colunaChave: string;
  agrupamento: AgrupamentoKanban;
  comodos: TagItem[] | undefined;
  /** Última execução, se foi feita com atraso. */
  atraso: HistoricoTarefa | null;
  onFeita: (tarefa: TarefaManutencao) => void;
  onEditar: (tarefa: TarefaManutencao) => void;
  onHistorico: (tarefa: TarefaManutencao) => void;
}

function Cartao({ tarefa, colunaChave, agrupamento, comodos, atraso, onFeita, onEditar, onHistorico }: CartaoProps) {
  const arrastavel = useDraggable({ id: `${tarefa.id}${SEPARADOR}${colunaChave}` });
  const style = { transform: CSS.Translate.toString(arrastavel.transform) };
  return (
    <article ref={arrastavel.setNodeRef} style={style} className={`kanban-cartao${tarefa.ativo ? '' : ' conta-inativa'}${arrastavel.isDragging ? ' kanban-cartao-arrastando' : ''}`}>
      <div className="kanban-cartao-topo">
        <button
          type="button"
          className="btn-icone documentos-arrastar kanban-alca"
          title={`Arrastar ${tarefa.nome}`}
          aria-label={`Arrastar ${tarefa.nome}`}
          {...arrastavel.attributes}
          {...arrastavel.listeners}
        >
          <IconeFuncao funcao="mover" />
        </button>
        <strong>{tarefa.nome}</strong>
      </div>
      <span className="conta-detalhe">
        {agrupamento === 'comodo' ? `${rotuloPeriodo(tarefa.frequencia_dias)} · ` : ''}próxima em {formatarData(proximaExecucao(tarefa))}
      </span>
      {atraso?.data_prevista && (
        <span className="manutencao-flag-atraso" title={`Feita com atraso em ${formatarData(atraso.data_execucao)}`}>
          <IconeBandeira /> Feita com atraso (devia ser {formatarData(atraso.data_prevista)})
        </span>
      )}
      {agrupamento === 'periodo' && <TagsChips tags={comodos} />}
      <div className="hierarquia-item-acoes">
        <button type="button" onClick={() => onFeita(tarefa)}>
          Feita hoje
        </button>
        <button type="button" onClick={() => onHistorico(tarefa)} title={`Histórico de ${tarefa.nome}`} aria-label={`Histórico de ${tarefa.nome}`}>
          Histórico
        </button>
        <button type="button" className="btn-icone" onClick={() => onEditar(tarefa)} title={`Editar ${tarefa.nome}`} aria-label={`Editar ${tarefa.nome}`}>
          <IconeFuncao funcao="editar" />
        </button>
      </div>
    </article>
  );
}

function ColunaKanban({ coluna, children }: { coluna: Coluna; children: ReactNode }) {
  const { setNodeRef, isOver } = useDroppable({ id: PREFIXO_COLUNA + coluna.chave });
  return (
    <section ref={setNodeRef} className={`kanban-coluna${isOver ? ' kanban-coluna-alvo' : ''}`} role="listitem" aria-label={coluna.titulo}>
      <h3 className="kanban-coluna-titulo">{coluna.titulo}</h3>
      {coluna.tarefas.length === 0 && <p className="hierarquia-vazio">Nenhuma tarefa.</p>}
      {children}
    </section>
  );
}

interface KanbanProps {
  tarefas: TarefaManutencao[];
  comodos: TagItem[];
  comodosPorTarefa: Map<string, TagItem[]>;
  agrupamento: AgrupamentoKanban;
  /** Tarefa -> última execução, só das que foram feitas com atraso. */
  atrasoPorTarefa: Map<string, HistoricoTarefa>;
  onFeita: (tarefa: TarefaManutencao) => void;
  onEditar: (tarefa: TarefaManutencao) => void;
  onHistorico: (tarefa: TarefaManutencao) => void;
  /** Soltou um cartão em outra coluna. */
  onMover: (tarefa: TarefaManutencao, colunaOrigem: string, colunaDestino: string) => void;
}

/** Quadro de tarefas por cômodo ou por período (diária, semanal, mensal...). Arrastar o cartão para outra coluna muda o cômodo ou o período. */
export function ManutencaoKanban({ tarefas, comodos, comodosPorTarefa, agrupamento, atrasoPorTarefa, onFeita, onEditar, onHistorico, onMover }: KanbanProps) {
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));
  const colunas = agrupamento === 'comodo' ? colunasPorComodo(tarefas, comodos, comodosPorTarefa) : colunasPorPeriodo(tarefas);
  const tarefaPorId = new Map(tarefas.map((t) => [t.id, t]));

  function aoSoltar({ active, over }: DragEndEvent) {
    if (!over) return;
    const alvo = String(over.id);
    if (!alvo.startsWith(PREFIXO_COLUNA)) return;
    const [tarefaId, origem] = String(active.id).split(SEPARADOR);
    const tarefa = tarefaPorId.get(tarefaId);
    const destino = alvo.slice(PREFIXO_COLUNA.length);
    if (tarefa && origem !== destino) onMover(tarefa, origem, destino);
  }

  return (
    <DndContext sensors={sensors} collisionDetection={pointerWithin} onDragEnd={aoSoltar}>
      <div className="kanban" role="list" aria-label={agrupamento === 'comodo' ? 'Tarefas por cômodo' : 'Tarefas por período'}>
        {colunas.map((coluna) => (
          <ColunaKanban key={coluna.chave} coluna={coluna}>
            {coluna.tarefas.map((tarefa) => (
              <Cartao
                key={tarefa.id}
                tarefa={tarefa}
                colunaChave={coluna.chave}
                agrupamento={agrupamento}
                comodos={comodosPorTarefa.get(tarefa.id)}
                atraso={atrasoPorTarefa.get(tarefa.id) ?? null}
                onFeita={onFeita}
                onEditar={onEditar}
                onHistorico={onHistorico}
              />
            ))}
          </ColunaKanban>
        ))}
      </div>
    </DndContext>
  );
}
