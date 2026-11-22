import { IconeFuncao } from '../../components/IconeUso';
import { TagsChips } from '../../components/TagsChips';
import { formatarData } from '../../lib/datas';
import { rotuloPeriodo } from '../../lib/filtrosManutencao';
import { proximaExecucao } from '../../lib/manutencao';
import type { ClassificacaoTarefa, TarefaManutencao } from '../../types';

export type AgrupamentoKanban = 'comodo' | 'periodo';

interface Coluna {
  chave: string;
  titulo: string;
  tarefas: TarefaManutencao[];
}

const CHAVE_SEM_COMODO = 'sem-comodo';

/** Uma coluna por cômodo; tarefa com mais de um cômodo aparece em cada um. Colunas sem tarefa não aparecem. */
function colunasPorComodo(
  tarefas: TarefaManutencao[],
  comodos: ClassificacaoTarefa[],
  comodosPorTarefa: Map<string, ClassificacaoTarefa[]>
): Coluna[] {
  const colunas: Coluna[] = comodos.map((c) => ({ chave: c.id, titulo: c.nome, tarefas: [] }));
  const porId = new Map(colunas.map((c) => [c.chave, c]));
  const semComodo: Coluna = { chave: CHAVE_SEM_COMODO, titulo: 'Sem cômodo', tarefas: [] };
  for (const tarefa of tarefas) {
    const dela = comodosPorTarefa.get(tarefa.id) ?? [];
    const colunasDela = dela.map((c) => porId.get(c.id)).filter((c): c is Coluna => !!c);
    if (colunasDela.length === 0) semComodo.tarefas.push(tarefa);
    for (const coluna of colunasDela) coluna.tarefas.push(tarefa);
  }
  return [...colunas, semComodo].filter((c) => c.tarefas.length > 0);
}

/** Uma coluna por período (frequência da tarefa), do mais curto ao mais longo; dentro dela, pela próxima execução. */
function colunasPorPeriodo(tarefas: TarefaManutencao[]): Coluna[] {
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

interface KanbanProps {
  tarefas: TarefaManutencao[];
  comodos: ClassificacaoTarefa[];
  comodosPorTarefa: Map<string, ClassificacaoTarefa[]>;
  agrupamento: AgrupamentoKanban;
  onFeita: (tarefa: TarefaManutencao) => void;
  onEditar: (tarefa: TarefaManutencao) => void;
}

/** Quadro de tarefas por cômodo ou por período (diária, semanal, mensal...). */
export function ManutencaoKanban({ tarefas, comodos, comodosPorTarefa, agrupamento, onFeita, onEditar }: KanbanProps) {
  const colunas = agrupamento === 'comodo' ? colunasPorComodo(tarefas, comodos, comodosPorTarefa) : colunasPorPeriodo(tarefas);
  return (
    <div className="kanban" role="list" aria-label={agrupamento === 'comodo' ? 'Tarefas por cômodo' : 'Tarefas por período'}>
      {colunas.map((coluna) => (
        <section key={coluna.chave} className="kanban-coluna" role="listitem" aria-label={coluna.titulo}>
          <h3 className="kanban-coluna-titulo">{coluna.titulo}</h3>
          {coluna.tarefas.length === 0 && <p className="hierarquia-vazio">Nenhuma tarefa.</p>}
          {coluna.tarefas.map((tarefa) => (
            <article key={tarefa.id} className={`kanban-cartao${tarefa.ativo ? '' : ' conta-inativa'}`}>
              <strong>{tarefa.nome}</strong>
              <span className="conta-detalhe">
                {agrupamento === 'comodo' ? `${rotuloPeriodo(tarefa.frequencia_dias)} · ` : ''}próxima em {formatarData(proximaExecucao(tarefa))}
              </span>
              {agrupamento === 'periodo' && <TagsChips tags={comodosPorTarefa.get(tarefa.id)} />}
              <div className="hierarquia-item-acoes">
                <button type="button" onClick={() => onFeita(tarefa)}>
                  Feita hoje
                </button>
                <button type="button" className="btn-icone" onClick={() => onEditar(tarefa)} title={`Editar ${tarefa.nome}`} aria-label={`Editar ${tarefa.nome}`}>
                  <IconeFuncao funcao="editar" />
                </button>
              </div>
            </article>
          ))}
        </section>
      ))}
    </div>
  );
}
