import { useState, type ReactNode } from 'react';
import { DndContext, PointerSensor, pointerWithin, useDraggable, useDroppable, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import { IconeFuncao } from '../../components/IconeUso';
import { IconeBandeira } from '../../components/IconesProvisorios';
import { TagsChips } from '../../components/TagsChips';
import { LIMITE_AVISO_ADIAMENTOS } from '../../lib/adiamentos';
import { formatarData } from '../../lib/datas';
import { ROTULOS_DIA, resumoDosDias } from '../../lib/diasSemana';
import { rotuloPeriodo } from '../../lib/filtrosManutencao';
import { proximaExecucao } from '../../lib/manutencao';
import { colunaDoResponsavel, textoDoResponsavel } from '../../lib/responsaveis';
import type { HistoricoTarefa, PessoaDocumentos, TagItem, TarefaManutencao } from '../../types';

/** O que o cartão mostra sobre o adiamento da tarefa. */
export interface InfoAdiamento {
  /** Quem adiou (nome), se o registro tem. */
  quem: string | null;
  observacao: string | null;
  /** Quantas vezes foi adiada ou pulada desde a última execução. */
  vezes: number;
}

export type AgrupamentoKanban = 'comodo' | 'periodo' | 'dia' | 'pessoa';

export const CHAVE_SEM_COMODO = 'sem-comodo';
export const CHAVE_SEM_DIA = 'sem-dia';
export const PREFIXO_DIA = 'dia-';
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

/** Uma coluna por dia da semana (tarefa com dois dias aparece nos dois) e uma para as sem dia. */
export function colunasPorDia(tarefas: TarefaManutencao[]): Coluna[] {
  const colunas: Coluna[] = ROTULOS_DIA.map((titulo, dia) => ({ chave: `${PREFIXO_DIA}${dia}`, titulo, tarefas: [] }));
  const semDia: Coluna = { chave: CHAVE_SEM_DIA, titulo: 'Sem dia', tarefas: [] };
  for (const tarefa of tarefas) {
    if (tarefa.dias_semana.length === 0) semDia.tarefas.push(tarefa);
    for (const dia of tarefa.dias_semana) colunas[dia]?.tarefas.push(tarefa);
  }
  return [...colunas, semDia];
}

/** Uma coluna por pessoa, mais Qualquer um e Juntos (do casal) e Sem responsável. */
export function colunasPorPessoa(tarefas: TarefaManutencao[], pessoas: PessoaDocumentos[], membros: Map<string, string[]>): Coluna[] {
  const colunas: Coluna[] = [
    ...pessoas.map((p): Coluna => ({ chave: `pessoa:${p.id}`, titulo: p.nome, tarefas: [] })),
    { chave: 'qualquer', titulo: 'Qualquer um', tarefas: [] },
    { chave: 'juntos', titulo: 'Juntos', tarefas: [] },
    { chave: 'sem', titulo: 'Sem responsável', tarefas: [] },
  ];
  const porChave = new Map(colunas.map((c) => [c.chave, c]));
  for (const tarefa of tarefas) (porChave.get(colunaDoResponsavel(tarefa, membros)) ?? porChave.get('sem'))?.tarefas.push(tarefa);
  return colunas;
}

interface CartaoProps {
  tarefa: TarefaManutencao;
  colunaChave: string;
  agrupamento: AgrupamentoKanban;
  comodos: TagItem[] | undefined;
  /** Última execução, se foi feita com atraso. */
  atraso: HistoricoTarefa | null;
  /** Texto do responsável (vazio se não há). */
  responsavel: string;
  /** Adiamento vigente e contagem de adiamentos; null se a tarefa nunca foi adiada. */
  adiamento: InfoAdiamento | null;
  /** Histórico recolhido no pé do cartão. */
  historico: ReactNode;
  onFeita: (tarefa: TarefaManutencao) => void;
  onAdiar: (tarefa: TarefaManutencao) => void;
  onEditar: (tarefa: TarefaManutencao) => void;
}

/** "Adiada até dd/mm" com quem adiou e a observação, mais o aviso de adiamentos repetidos. */
export function SeloAdiamento({ tarefa, adiamento }: { tarefa: TarefaManutencao; adiamento: InfoAdiamento | null }) {
  const repetida = adiamento !== null && adiamento.vezes >= LIMITE_AVISO_ADIAMENTOS;
  if (!tarefa.adiada_ate && !repetida) return null;
  return (
    <>
      {tarefa.adiada_ate && (
        <span className="tag-chip" title={adiamento?.observacao ?? undefined}>
          Adiada até {formatarData(tarefa.adiada_ate)}
          {adiamento?.quem ? ` por ${adiamento.quem}` : ''}
        </span>
      )}
      {tarefa.adiada_ate && adiamento?.observacao && <span className="conta-detalhe">Observação: {adiamento.observacao}</span>}
      {repetida && <span className="manutencao-aviso-adiamentos">Adiada {adiamento.vezes} vezes desde a última vez que foi feita.</span>}
    </>
  );
}

function Cartao({ tarefa, colunaChave, agrupamento, comodos, atraso, responsavel, adiamento, historico, onFeita, onAdiar, onEditar }: CartaoProps) {
  const [aberto, setAberto] = useState(false);
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
        {tarefa.instrucoes ? (
          <button type="button" className="manutencao-nome-botao" aria-expanded={aberto} onClick={() => setAberto((a) => !a)} title={aberto ? 'Ocultar instruções' : 'Mostrar instruções'}>
            {tarefa.nome}
          </button>
        ) : (
          <strong>{tarefa.nome}</strong>
        )}
      </div>
      {aberto && tarefa.instrucoes && <p className="manutencao-instrucoes">{tarefa.instrucoes}</p>}
      {tarefa.dias_semana.length > 0 && agrupamento !== 'dia' && <span className="tag-chip">{resumoDosDias(tarefa.dias_semana)}</span>}
      <span className="conta-detalhe">
        {agrupamento !== 'periodo' ? `${rotuloPeriodo(tarefa.frequencia_dias)} · ` : ''}próxima em {formatarData(proximaExecucao(tarefa))}
      </span>
      <SeloAdiamento tarefa={tarefa} adiamento={adiamento} />
      {atraso?.data_prevista && (
        <span className="manutencao-flag-atraso" title={`Feita com atraso em ${formatarData(atraso.data_execucao)}`}>
          <IconeBandeira /> Feita com atraso (devia ser {formatarData(atraso.data_prevista)})
        </span>
      )}
      {agrupamento !== 'pessoa' && responsavel && <span className="tag-chip">{responsavel}</span>}
      {agrupamento !== 'comodo' && <TagsChips tags={comodos} />}
      <div className="hierarquia-item-acoes">
        <button type="button" onClick={() => onAdiar(tarefa)} title={`Adiar ${tarefa.nome}`} aria-label={`Adiar ${tarefa.nome}`}>
          Adiar
        </button>
        <button type="button" onClick={() => onFeita(tarefa)}>
          Feita hoje
        </button>
        <button type="button" className="btn-icone" onClick={() => onEditar(tarefa)} title={`Editar ${tarefa.nome}`} aria-label={`Editar ${tarefa.nome}`}>
          <IconeFuncao funcao="editar" />
        </button>
      </div>
      {historico}
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
  /** Pessoas individuais (colunas do kanban por pessoa). */
  pessoas: PessoaDocumentos[];
  membrosDosCasais: Map<string, string[]>;
  nomePorPessoa: Map<string, string>;
  /** Há casal cadastrado: Qualquer um e Juntos só funcionam com ele. */
  temCasal: boolean;
  /** Adiamento vigente de cada tarefa adiada (e quantas vezes foi adiada). */
  adiamentoPorTarefa: Map<string, InfoAdiamento>;
  /** Histórico recolhido de cada tarefa, no pé do cartão. */
  renderHistorico: (tarefa: TarefaManutencao) => ReactNode;
  onFeita: (tarefa: TarefaManutencao) => void;
  onAdiar: (tarefa: TarefaManutencao) => void;
  onEditar: (tarefa: TarefaManutencao) => void;
  /** Soltou um cartão em outra coluna. */
  onMover: (tarefa: TarefaManutencao, colunaOrigem: string, colunaDestino: string) => void;
}

/** Quadro de tarefas por cômodo ou por período (diária, semanal, mensal...). Arrastar o cartão para outra coluna muda o cômodo ou o período. */
export function ManutencaoKanban({ tarefas, comodos, comodosPorTarefa, agrupamento, atrasoPorTarefa, pessoas, membrosDosCasais, nomePorPessoa, temCasal, adiamentoPorTarefa, renderHistorico, onFeita, onAdiar, onEditar, onMover }: KanbanProps) {
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));
  const colunas =
    agrupamento === 'comodo'
      ? colunasPorComodo(tarefas, comodos, comodosPorTarefa)
      : agrupamento === 'dia'
        ? colunasPorDia(tarefas)
        : agrupamento === 'pessoa'
          ? colunasPorPessoa(tarefas, pessoas, membrosDosCasais).filter((c) => temCasal || (c.chave !== 'qualquer' && c.chave !== 'juntos'))
          : colunasPorPeriodo(tarefas);
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
      <div className="kanban" role="list" aria-label={agrupamento === 'comodo' ? 'Tarefas por cômodo' : agrupamento === 'dia' ? 'Tarefas por dia da semana' : agrupamento === 'pessoa' ? 'Tarefas por pessoa' : 'Tarefas por período'}>
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
                responsavel={textoDoResponsavel(tarefa, membrosDosCasais, nomePorPessoa)}
                adiamento={adiamentoPorTarefa.get(tarefa.id) ?? null}
                historico={renderHistorico(tarefa)}
                onFeita={onFeita}
                onAdiar={onAdiar}
                onEditar={onEditar}
              />
            ))}
          </ColunaKanban>
        ))}
      </div>
    </DndContext>
  );
}
