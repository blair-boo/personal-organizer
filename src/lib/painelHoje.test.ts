import { describe, expect, it } from 'vitest';
import { equilibrioDoMes, tarefasPorPessoa } from './painelHoje';
import type { HistoricoPessoa, HistoricoTarefa, PessoaDocumentos, TarefaManutencao } from '../types';

const HOJE = '2026-11-23';

const pessoa = (id: string, nome: string): PessoaDocumentos => ({ id, nome, tipo: 'pessoa', ordem: 0, usuario_id: null }) as PessoaDocumentos;
const eduardo = pessoa('e', 'Eduardo');
const mariana = pessoa('m', 'Mariana');
const membros = new Map([['casal', ['e', 'm']]]);

function tarefa(id: string, ultima: string | null, freq: number, extra: Partial<TarefaManutencao> = {}): TarefaManutencao {
  return {
    id, nome: id, frequencia_dias: freq, ultima_execucao: ultima, proxima_a_partir_de: null, adiada_ate: null, dias_semana: [], instrucoes: null,
    responsavel_tipo: 'nenhum', responsavel_pessoa_id: null, responsavel_casal_id: null, ativo: true, ...extra,
  };
}

describe('tarefasPorPessoa', () => {
  const tarefas = [
    tarefa('atrasada-e', '2026-11-10', 7, { responsavel_tipo: 'pessoa', responsavel_pessoa_id: 'e' }),
    tarefa('hoje-m', '2026-11-16', 7, { responsavel_tipo: 'pessoa', responsavel_pessoa_id: 'm' }),
    tarefa('casal-atrasada', '2026-11-01', 7, { responsavel_tipo: 'juntos', responsavel_casal_id: 'casal' }),
    tarefa('sem-dono', '2026-11-01', 7),
    tarefa('futura', '2026-11-20', 30, { responsavel_tipo: 'pessoa', responsavel_pessoa_id: 'e' }),
    tarefa('inativa', '2026-11-01', 7, { responsavel_tipo: 'pessoa', responsavel_pessoa_id: 'e', ativo: false }),
  ];

  it('separa atrasadas e de hoje, e a do casal aparece para os dois', () => {
    const r = tarefasPorPessoa(tarefas, [eduardo, mariana], membros, HOJE);
    const e = r.find((g) => g.chave === 'e')!;
    const m = r.find((g) => g.chave === 'm')!;
    expect(e.atrasadas.map((t) => t.id)).toEqual(['casal-atrasada', 'atrasada-e']);
    expect(e.paraHoje).toEqual([]);
    expect(m.atrasadas.map((t) => t.id)).toEqual(['casal-atrasada']);
    expect(m.paraHoje.map((t) => t.id)).toEqual(['hoje-m']);
  });

  it('cria o grupo sem responsável só quando há tarefa nele', () => {
    expect(tarefasPorPessoa(tarefas, [eduardo, mariana], membros, HOJE).at(-1)).toMatchObject({ chave: 'sem' });
    expect(tarefasPorPessoa([tarefa('x', '2026-11-22', 30)], [eduardo], membros, HOJE).map((g) => g.chave)).toEqual(['e']);
  });

  it('tarefa adiada para o futuro não conta como atrasada nem de hoje', () => {
    const adiada = tarefa('adiada', '2026-11-01', 7, { responsavel_tipo: 'pessoa', responsavel_pessoa_id: 'e', adiada_ate: '2026-12-01' });
    const e = tarefasPorPessoa([adiada], [eduardo], membros, HOJE)[0];
    expect(e.atrasadas).toEqual([]);
    expect(e.paraHoje).toEqual([]);
  });
});

describe('equilibrioDoMes', () => {
  const exec = (id: string, data: string): HistoricoTarefa => ({ id, tarefa_id: 't', data_execucao: data, data_prevista: null, base_proxima: 'execucao', observacao: null, criado_em: data });
  const historico = [exec('h1', '2026-11-02'), exec('h2', '2026-11-05'), exec('h3', '2026-11-09'), exec('h4', '2026-11-10'), exec('h5', '2026-10-30')];
  const quem: HistoricoPessoa[] = [
    { historico_id: 'h1', pessoa_id: 'e' },
    { historico_id: 'h2', pessoa_id: 'e' },
    { historico_id: 'h3', pessoa_id: 'e' },
    { historico_id: 'h3', pessoa_id: 'm' },
    { historico_id: 'h5', pessoa_id: 'm' },
  ];

  it('conta sozinha, junto e sem registro só do mês pedido', () => {
    const r = equilibrioDoMes(historico, quem, [eduardo, mariana], '2026-11');
    expect(r.execucoes).toBe(4);
    expect(r.semRegistro).toBe(1);
    expect(r.pessoas).toEqual([
      { pessoaId: 'e', nome: 'Eduardo', sozinha: 2, junto: 1, total: 3 },
      { pessoaId: 'm', nome: 'Mariana', sozinha: 0, junto: 1, total: 1 },
    ]);
  });

  it('mês sem execuções fica zerado', () => {
    expect(equilibrioDoMes(historico, quem, [eduardo], '2026-09')).toEqual({ execucoes: 0, semRegistro: 0, pessoas: [{ pessoaId: 'e', nome: 'Eduardo', sozinha: 0, junto: 0, total: 0 }] });
  });
});
