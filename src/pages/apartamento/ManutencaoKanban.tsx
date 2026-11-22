import { IconeFuncao } from '../../components/IconeUso';
import { TagsChips } from '../../components/TagsChips';
import { formatarData } from '../../lib/datas';
import { CHAVES_SEMANA, ROTULOS_SEMANA, rotuloPeriodo, semanaDaTarefa } from '../../lib/filtrosManutencao';
import { proximaExecucao } from '../../lib/manutencao';
import type { ClassificacaoTarefa, TarefaManutencao } from '../../types';

export type AgrupamentoKanban = 'comodo' | 'semana';

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

/** Uma coluna por semana, pela próxima execução. Atrasadas e Mais adiante só aparecem se tiverem tarefa. */
function colunasPorSemana(tarefas: TarefaManutencao[], hoje: string): Coluna[] {
  const colunas = CHAVES_SEMANA.map((chave) => ({ chave, titulo: ROTULOS_SEMANA[chave], tarefas: [] as TarefaManutencao[] }));
  const porChave = new Map(colunas.map((c) => [c.chave, c]));
  for (const tarefa of tarefas) porChave.get(semanaDaTarefa(tarefa, hoje))?.tarefas.push(tarefa);
  return colunas.filter((c) => c.tarefas.length > 0 || !['atrasadas', 'depois'].includes(c.chave));
}

interface KanbanProps {
  tarefas: TarefaManutencao[];
  comodos: ClassificacaoTarefa[];
  comodosPorTarefa: Map<string, ClassificacaoTarefa[]>;
  agrupamento: AgrupamentoKanban;
  hoje: string;
  onFeita: (tarefa: TarefaManutencao) => void;
  onEditar: (tarefa: TarefaManutencao) => void;
}

/** Quadro de tarefas por cômodo ou por semana. */
export function ManutencaoKanban({ tarefas, comodos, comodosPorTarefa, agrupamento, hoje, onFeita, onEditar }: KanbanProps) {
  const colunas = agrupamento === 'comodo' ? colunasPorComodo(tarefas, comodos, comodosPorTarefa) : colunasPorSemana(tarefas, hoje);
  return (
    <div className="kanban" role="list" aria-label={agrupamento === 'comodo' ? 'Tarefas por cômodo' : 'Tarefas por semana'}>
      {colunas.map((coluna) => (
        <section key={coluna.chave} className="kanban-coluna" role="listitem" aria-label={coluna.titulo}>
          <h3 className="kanban-coluna-titulo">{coluna.titulo}</h3>
          {coluna.tarefas.length === 0 && <p className="hierarquia-vazio">Nenhuma tarefa.</p>}
          {coluna.tarefas.map((tarefa) => (
            <article key={tarefa.id} className={`kanban-cartao${tarefa.ativo ? '' : ' conta-inativa'}`}>
              <strong>{tarefa.nome}</strong>
              <span className="conta-detalhe">
                {rotuloPeriodo(tarefa.frequencia_dias)} · próxima em {formatarData(proximaExecucao(tarefa))}
              </span>
              {agrupamento === 'semana' && <TagsChips tags={comodosPorTarefa.get(tarefa.id)} />}
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
