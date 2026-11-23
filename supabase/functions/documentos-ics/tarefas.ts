// Lógica pura das tarefas de manutenção no feed .ics (sem dependências do Deno,
// para poder ser testada com o vitest). Espelha src/lib/manutencao.ts e
// src/lib/responsaveis.ts: se a regra mudar lá, mude aqui também.

export interface LinhaTarefa {
  id: string;
  nome: string;
  frequencia_dias: number;
  ultima_execucao: string | null;
  proxima_a_partir_de: string | null;
  adiada_ate: string | null;
  responsavel_tipo: "nenhum" | "pessoa" | "qualquer" | "juntos";
  responsavel_pessoa_id: string | null;
  responsavel_casal_id: string | null;
  ativo: boolean;
}

export interface EventoTarefa {
  id: string;
  resumo: string;
  data: string;
}

/** Tarefas diárias e semanais lotariam o calendário: não entram. */
const FREQUENCIAS_FORA = new Set([1, 7]);

export function somarDias(dataIso: string, dias: number): string {
  const [a, m, d] = dataIso.split("-").map(Number);
  const data = new Date(Date.UTC(a, m - 1, d + dias));
  return data.toISOString().slice(0, 10);
}

/** Próxima execução: a adiada, ou a data-base + frequência; hoje se nunca foi feita. */
export function proximaExecucao(t: LinhaTarefa, hoje: string): string {
  if (t.adiada_ate) return t.adiada_ate;
  const base = t.proxima_a_partir_de ?? t.ultima_execucao;
  return base ? somarDias(base, t.frequencia_dias) : hoje;
}

export function pessoasDaTarefa(t: LinhaTarefa, membros: Map<string, string[]>): string[] {
  if (t.responsavel_tipo === "pessoa" && t.responsavel_pessoa_id) return [t.responsavel_pessoa_id];
  if ((t.responsavel_tipo === "qualquer" || t.responsavel_tipo === "juntos") && t.responsavel_casal_id) return membros.get(t.responsavel_casal_id) ?? [];
  return [];
}

/**
 * Eventos das tarefas para o link. `pessoaIds` vazio = todas as pessoas (inclui as
 * sem responsável); senão só as tarefas dessas pessoas (a do casal conta para os dois).
 * Cada tarefa vira um evento na próxima execução; se já passou, cai em hoje como "Atrasada".
 */
export function eventosDasTarefas(
  tarefas: LinhaTarefa[],
  comodosPorTarefa: Map<string, string[]>,
  membros: Map<string, string[]>,
  pessoaIds: string[],
  hoje: string
): EventoTarefa[] {
  const eventos: EventoTarefa[] = [];
  for (const t of tarefas) {
    if (!t.ativo || FREQUENCIAS_FORA.has(t.frequencia_dias)) continue;
    if (pessoaIds.length > 0 && !pessoasDaTarefa(t, membros).some((id) => pessoaIds.includes(id))) continue;
    const prevista = proximaExecucao(t, hoje);
    const atrasada = t.ultima_execucao !== null && prevista < hoje;
    const comodos = comodosPorTarefa.get(t.id) ?? [];
    const nome = comodos.length > 0 ? `${t.nome} (${comodos.join(", ")})` : t.nome;
    eventos.push({ id: `tarefa-${t.id}`, resumo: atrasada ? `Atrasada: ${nome}` : nome, data: atrasada ? hoje : prevista });
  }
  return eventos;
}
