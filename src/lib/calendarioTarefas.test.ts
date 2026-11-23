import { describe, expect, it } from 'vitest';
import { eventosDasTarefas, proximaExecucao, type LinhaTarefa } from '../../supabase/functions/documentos-ics/tarefas';

const HOJE = '2026-11-23';

function t(id: string, nome: string, freq: number, ultima: string | null, extra: Partial<LinhaTarefa> = {}): LinhaTarefa {
  return { id, nome, frequencia_dias: freq, ultima_execucao: ultima, proxima_a_partir_de: null, adiada_ate: null, responsavel_tipo: 'nenhum', responsavel_pessoa_id: null, responsavel_casal_id: null, ativo: true, ...extra };
}

const membros = new Map([['casal', ['e', 'm']]]);
const comodos = new Map([['t1', ['Cozinha', 'Varanda']]]);

describe('eventosDasTarefas', () => {
  it('só entram tarefas ativas que não são diárias nem semanais, com o cômodo no título', () => {
    const r = eventosDasTarefas(
      [t('t1', 'Limpar o forno', 30, '2026-11-20'), t('d', 'Lixo', 1, '2026-11-22'), t('s', 'Regar', 7, '2026-11-20'), t('i', 'Inativa', 30, '2026-11-20', { ativo: false })],
      comodos, membros, [], HOJE
    );
    expect(r).toEqual([{ id: 'tarefa-t1', resumo: 'Limpar o forno (Cozinha, Varanda)', data: '2026-12-20' }]);
  });

  it('atrasada cai em hoje com o prefixo; nunca feita entra hoje sem prefixo', () => {
    const r = eventosDasTarefas([t('a', 'Calhas', 90, '2026-06-01'), t('n', 'Filtro', 30, null)], new Map(), membros, [], HOJE);
    expect(r).toEqual([
      { id: 'tarefa-a', resumo: 'Atrasada: Calhas', data: HOJE },
      { id: 'tarefa-n', resumo: 'Filtro', data: HOJE },
    ]);
  });

  it('segue o adiamento e a data-base original', () => {
    expect(proximaExecucao(t('x', 'x', 30, '2026-11-01', { adiada_ate: '2026-12-25' }), HOJE)).toBe('2026-12-25');
    expect(proximaExecucao(t('x', 'x', 30, '2026-11-10', { proxima_a_partir_de: '2026-11-05' }), HOJE)).toBe('2026-12-05');
  });

  it('filtra por pessoa: a do casal conta para os dois e a sem responsável só vale para "todas"', () => {
    const lista = [
      t('p', 'Da Ana', 30, '2026-11-20', { responsavel_tipo: 'pessoa', responsavel_pessoa_id: 'e' }),
      t('c', 'Do casal', 30, '2026-11-20', { responsavel_tipo: 'juntos', responsavel_casal_id: 'casal' }),
      t('s', 'Sem dono', 30, '2026-11-20'),
    ];
    expect(eventosDasTarefas(lista, new Map(), membros, ['m'], HOJE).map((e) => e.id)).toEqual(['tarefa-c']);
    expect(eventosDasTarefas(lista, new Map(), membros, ['e'], HOJE).map((e) => e.id)).toEqual(['tarefa-p', 'tarefa-c']);
    expect(eventosDasTarefas(lista, new Map(), membros, [], HOJE)).toHaveLength(3);
  });
});
