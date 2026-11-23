import { describe, expect, it } from 'vitest';
import {
  aplicarAtualizarExecucao,
  aplicarAtualizarLinha,
  aplicarDefinirClassificacoes,
  aplicarExcluirLinhas,
  aplicarInserirLinha,
  aplicarDefinirAdiamento,
  aplicarDefinirPessoasExecucao,
  aplicarEdicaoStorage,
  aplicarExcluirExecucao,
  aplicarInserirExecucao,
  aplicarSalvarCaixa,
  type EstadoManutencao,
  type EstadoStorage,
} from './aplicarLocal';

const base = (): EstadoStorage => ({
  caixas: [
    { id: 'c1', numero: 1, nome: 'Cozinha', ordem: 1 },
    { id: 'c2', numero: 2, nome: 'Ferramentas', ordem: 2 },
  ],
  itens: [
    { id: 'i1', storage_id: 'c1', nome: 'Panela', quantidade: 2, tag_id: null, ordem: 1 },
    { id: 'i2', storage_id: 'c1', nome: 'Colher', quantidade: null, tag_id: null, ordem: 2 },
    { id: 'i3', storage_id: 'c2', nome: 'Martelo', quantidade: 1, tag_id: null, ordem: 1 },
  ],
  obs: [{ id: 'o1', item_id: 'i1', texto: 'Tampa quebrada', ordem: 1 }],
  anexos: [
    { id: 'a1', item_id: 'i1', nome: 'Foto', arquivo_url: 'storage/i1/foto.png', nome_arquivo: 'foto.png' },
    { id: 'a2', item_id: 'i3', nome: 'Foto 2', arquivo_url: 'storage/i3/foto.png', nome_arquivo: 'foto.png' },
  ],
});

describe('aplicarSalvarCaixa', () => {
  it('caixa nova entra com número, itens, observações e anexos', () => {
    const r = aplicarSalvarCaixa(base(), {
      id: 'c3',
      numero: 3,
      nome: 'Banheiro',
      novo: true,
      ordemNova: 3,
      itens: [
        {
          id: 'i4',
          nome: 'Toalha',
          quantidade: 3,
          tag_id: 't1',
          obs: ['Azul'],
          anexosNovos: [{ id: 'a9', nome: 'Foto', arquivo_url: 'storage/i4/foto.png', nome_arquivo: 'foto.png' }],
          anexosRemovidos: [],
        },
      ],
      itensRemovidos: [],
    });
    expect(r.caixas.at(-1)).toEqual({ id: 'c3', numero: 3, nome: 'Banheiro', ordem: 3 });
    expect(r.itens.find((i) => i.id === 'i4')).toMatchObject({ storage_id: 'c3', nome: 'Toalha', quantidade: 3, tag_id: 't1', ordem: 1 });
    expect(r.obs.filter((o) => o.item_id === 'i4').map((o) => o.texto)).toEqual(['Azul']);
    expect(r.anexos.find((a) => a.id === 'a9')?.item_id).toBe('i4');
  });

  it('editar troca o nome, o item, as observações e tira o anexo e o item removidos', () => {
    const r = aplicarSalvarCaixa(base(), {
      id: 'c1',
      nome: 'Cozinha geral',
      novo: false,
      ordemNova: 9,
      itens: [{ id: 'i1', nome: 'Panela grande', quantidade: 1, tag_id: null, obs: ['Nova obs'], anexosNovos: [], anexosRemovidos: [base().anexos[0]] }],
      itensRemovidos: ['i2'],
    });
    expect(r.caixas.find((c) => c.id === 'c1')?.nome).toBe('Cozinha geral');
    expect(r.itens.filter((i) => i.storage_id === 'c1').map((i) => i.nome)).toEqual(['Panela grande']);
    expect(r.obs.filter((o) => o.item_id === 'i1').map((o) => o.texto)).toEqual(['Nova obs']);
    expect(r.anexos.map((a) => a.id)).toEqual(['a2']);
    // as outras caixas ficam como estavam
    expect(r.itens.find((i) => i.id === 'i3')).toBeDefined();
  });

  it('não mexe no estado original', () => {
    const original = base();
    aplicarSalvarCaixa(original, { id: 'c1', nome: 'X', novo: false, ordemNova: 1, itens: [], itensRemovidos: ['i1'] });
    expect(original.itens).toHaveLength(3);
  });
});

describe('aplicarEdicaoStorage', () => {
  it('reordena, renomeia, move item de caixa e exclui', () => {
    const r = aplicarEdicaoStorage(base(), {
      caixas: [{ id: 'c2', ordem: 1 }, { id: 'c1', ordem: 2 }],
      itens: [{ id: 'i3', storage_id: 'c1', ordem: 3 }],
      renomeacoes: [{ id: 'c2', nome: 'Ferragens' }],
      caixasExcluidas: [],
      itensExcluidos: ['i2'],
    });
    expect(r.caixas.map((c) => [c.id, c.nome, c.ordem])).toEqual([['c1', 'Cozinha', 2], ['c2', 'Ferragens', 1]]);
    expect(r.itens.find((i) => i.id === 'i3')).toMatchObject({ storage_id: 'c1', ordem: 3 });
    expect(r.itens.find((i) => i.id === 'i2')).toBeUndefined();
  });

  it('excluir caixa leva os itens que ficaram nela, com observações e anexos, mas não os que saíram', () => {
    const r = aplicarEdicaoStorage(base(), {
      caixas: [{ id: 'c2', ordem: 1 }],
      itens: [{ id: 'i1', storage_id: 'c2', ordem: 2 }],
      renomeacoes: [],
      caixasExcluidas: ['c1'],
      itensExcluidos: [],
    });
    expect(r.caixas.map((c) => c.id)).toEqual(['c2']);
    expect(r.itens.map((i) => i.id).sort()).toEqual(['i1', 'i3']);
    expect(r.obs.map((o) => o.item_id)).toEqual(['i1']);
    expect(r.anexos.map((a) => a.id).sort()).toEqual(['a1', 'a2']);
  });
});

const manutencao = (): EstadoManutencao => ({
  tarefas: [{ id: 't1', nome: 'Forno', frequencia_dias: 30, ultima_execucao: null, proxima_a_partir_de: null, adiada_ate: null, responsavel_tipo: 'nenhum', responsavel_pessoa_id: null, responsavel_casal_id: null, dias_semana: [], instrucoes: null, ativo: true }],
  historico: [],
  historicoPessoas: [],
});

describe('histórico de execuções', () => {
  it('inserir atualiza a última execução e a data-base da tarefa', () => {
    const r = aplicarInserirExecucao(
      manutencao(),
      { id: 'h1', tarefaId: 't1', dataExecucao: '2026-11-10', dataPrevista: '2026-11-05', base: 'prevista', pessoaIds: [] },
      '2026-11-10T10:00:00Z'
    );
    expect(r.historico).toHaveLength(1);
    expect(r.tarefas[0]).toMatchObject({ ultima_execucao: '2026-11-10', proxima_a_partir_de: '2026-11-05' });
  });

  it('atualizar a base volta a contar do dia em que foi feita', () => {
    const inserido = aplicarInserirExecucao(manutencao(), { id: 'h1', tarefaId: 't1', dataExecucao: '2026-11-10', dataPrevista: '2026-11-05', base: 'prevista', pessoaIds: [] });
    const r = aplicarAtualizarExecucao(inserido, { id: 'h1', tarefaId: 't1', base: 'execucao' });
    expect(r.tarefas[0]).toMatchObject({ ultima_execucao: '2026-11-10', proxima_a_partir_de: null });
  });

  it('atualizar a data muda a última execução', () => {
    const inserido = aplicarInserirExecucao(manutencao(), { id: 'h1', tarefaId: 't1', dataExecucao: '2026-11-10', dataPrevista: null, base: 'execucao', pessoaIds: [] });
    expect(aplicarAtualizarExecucao(inserido, { id: 'h1', tarefaId: 't1', dataExecucao: '2026-11-08' }).tarefas[0].ultima_execucao).toBe('2026-11-08');
  });

  it('excluir a única execução deixa a tarefa como nunca feita', () => {
    const inserido = aplicarInserirExecucao(manutencao(), { id: 'h1', tarefaId: 't1', dataExecucao: '2026-11-10', dataPrevista: null, base: 'execucao', pessoaIds: [] });
    const r = aplicarExcluirExecucao(inserido, { id: 'h1', tarefaId: 't1' });
    expect(r.historico).toEqual([]);
    expect(r.tarefas[0]).toMatchObject({ ultima_execucao: null, proxima_a_partir_de: null });
  });

  it('guarda quem fez, troca depois e apaga junto com a execução', () => {
    const inserido = aplicarInserirExecucao(manutencao(), { id: 'h1', tarefaId: 't1', dataExecucao: '2026-11-10', dataPrevista: null, base: 'execucao', pessoaIds: ['m'] });
    expect(inserido.historicoPessoas).toEqual([{ historico_id: 'h1', pessoa_id: 'm' }]);
    const trocado = aplicarDefinirPessoasExecucao(inserido, { historicoId: 'h1', pessoaIds: ['e', 'm'] });
    expect(trocado.historicoPessoas.map((h) => h.pessoa_id)).toEqual(['e', 'm']);
    expect(aplicarExcluirExecucao(trocado, { id: 'h1', tarefaId: 't1' }).historicoPessoas).toEqual([]);
  });

  it('só recalcula a tarefa da execução', () => {
    const estado = manutencao();
    estado.tarefas.push({ ...estado.tarefas[0], id: 't2', ultima_execucao: '2026-01-01' });
    const r = aplicarInserirExecucao(estado, { id: 'h1', tarefaId: 't1', dataExecucao: '2026-11-10', dataPrevista: null, base: 'execucao', pessoaIds: [] });
    expect(r.tarefas.find((t) => t.id === 't2')?.ultima_execucao).toBe('2026-01-01');
  });

  it('adiar guarda a data e fazer a tarefa encerra o adiamento', () => {
    const adiada = aplicarDefinirAdiamento(manutencao(), { tarefaId: 't1', adiadaAte: '2026-12-01' });
    expect(adiada.tarefas[0].adiada_ate).toBe('2026-12-01');
    const feita = aplicarInserirExecucao(adiada, { id: 'h1', tarefaId: 't1', dataExecucao: '2026-11-20', dataPrevista: null, base: 'execucao', pessoaIds: [] });
    expect(feita.tarefas[0].adiada_ate).toBeNull();
    expect(aplicarDefinirAdiamento(adiada, { tarefaId: 't1', adiadaAte: null }).tarefas[0].adiada_ate).toBeNull();
  });

  it('uma execução antiga incluída à mão não encerra o adiamento', () => {
    const base = aplicarInserirExecucao(manutencao(), { id: 'h1', tarefaId: 't1', dataExecucao: '2026-11-10', dataPrevista: null, base: 'execucao', pessoaIds: [] });
    const adiada = aplicarDefinirAdiamento(base, { tarefaId: 't1', adiadaAte: '2026-12-20' });
    const r = aplicarInserirExecucao(adiada, { id: 'h2', tarefaId: 't1', dataExecucao: '2026-10-01', dataPrevista: null, base: 'execucao', pessoaIds: [] });
    expect(r.tarefas[0].adiada_ate).toBe('2026-12-20');
  });
});

describe('linhas genéricas', () => {
  const lista = [{ id: 'a', nome: 'Beta', data: '2026-01-02' }, { id: 'b', nome: 'Alfa', data: '2026-01-05' }];

  it('inserir coloca a linha no lugar da ordem e ganha criado_em só na tela', () => {
    const r = aplicarInserirLinha(lista, { linha: { id: 'c', nome: 'Gama', data: '2026-01-09' }, ordenarPor: { campo: 'data', decrescente: true } }, '2026-02-01T00:00:00Z');
    expect(r.map((l) => l.id)).toEqual(['c', 'b', 'a']);
    expect(r[0]).toMatchObject({ criado_em: '2026-02-01T00:00:00Z' });
  });

  it('inserir uma linha com id que já existe troca a linha', () => {
    const r = aplicarInserirLinha(lista, { linha: { id: 'a', nome: 'Novo', data: '2026-01-02' } });
    expect(r).toHaveLength(2);
    expect(r.find((l) => l.id === 'a')?.nome).toBe('Novo');
  });

  it('atualizar muda só a linha e reordena; excluir tira da lista', () => {
    const r = aplicarAtualizarLinha(lista, { id: 'a', mudancas: { nome: 'Zeta' }, ordenarPor: { campo: 'nome' } });
    expect(r.map((l) => l.nome)).toEqual(['Alfa', 'Zeta']);
    expect(aplicarExcluirLinhas(lista, { ids: ['a'] }).map((l) => l.id)).toEqual(['b']);
  });

  it('cômodos da tarefa: troca o conjunto e apaga a entrada quando fica vazio', () => {
    const tag = { id: 't1', nome: 'Cozinha', cor: null, icone_url: null } as never;
    const mapa = aplicarDefinirClassificacoes(new Map(), { tarefaId: 'x', tagIds: ['t1'], tags: [tag] });
    expect(mapa.get('x')).toEqual([tag]);
    expect(aplicarDefinirClassificacoes(mapa, { tarefaId: 'x', tagIds: [], tags: [] }).has('x')).toBe(false);
  });
});
