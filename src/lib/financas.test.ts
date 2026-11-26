import { describe, expect, it } from 'vitest';
import {
  calcularAcerto,
  chaveDoEscopo,
  comEscopo,
  contasDoEscopo,
  donoDoEscopo,
  escolherRegra,
  escopoDoParametro,
  lancamentosDoEscopo,
  parametroDoEscopo,
  partesDoLancamento,
  podeEditarConta,
  podeEditarEscopo,
} from './financas';
import type { Conta, FinancasAcesso, Lancamento } from '../types';

const MARIANA = 'mariana';
const EDUARDO = 'eduardo';

function conta(id: string, dono: string, extras: Partial<Conta> = {}): Conta {
  return {
    id,
    nome: id,
    tipo: 'conta_corrente',
    instituicao: 'Banco',
    cor: null,
    status: 'ativo',
    conta_vinculada_id: null,
    emissora: null,
    ultimos_4_digitos: null,
    formato: null,
    subtipo_virtual: null,
    valor_deposito_mensal: null,
    dia_deposito: null,
    dono_id: dono,
    conjunta: false,
    donos: [],
    ...extras,
  };
}

function lanc(id: string, contaId: string, extras: Partial<Lancamento> = {}): Lancamento {
  return {
    id,
    conta_id: contaId,
    importacao_id: null,
    data: '2026-11-01',
    descricao_original: id,
    descricao_normalizada: id,
    valor: 100,
    tipo: 'saida',
    categoria_id: null,
    parcela_atual: null,
    parcela_total: null,
    observacao: null,
    conjunto: false,
    conjunto_com: null,
    pagador_id: null,
    divisao_percentual: 50,
    ...extras,
  };
}

const contas = [
  conta('m1', MARIANA),
  conta('e1', EDUARDO),
  conta('casa', MARIANA, { conjunta: true, donos: [MARIANA, EDUARDO] }),
  conta('outra', 'estranho', { conjunta: true, donos: ['estranho', 'fulano'] }),
];

describe('escopo na URL', () => {
  it('sem valor ou com o meu id é "eu"', () => {
    expect(escopoDoParametro(null, MARIANA)).toEqual({ tipo: 'eu' });
    expect(escopoDoParametro('eu', MARIANA)).toEqual({ tipo: 'eu' });
    expect(escopoDoParametro(MARIANA, MARIANA)).toEqual({ tipo: 'eu' });
  });

  it('reconhece Conjunto e outra pessoa', () => {
    expect(escopoDoParametro('conjunto', MARIANA)).toEqual({ tipo: 'conjunto' });
    expect(escopoDoParametro(EDUARDO, MARIANA)).toEqual({ tipo: 'pessoa', usuarioId: EDUARDO });
  });

  it('monta o parâmetro, o caminho e a chave', () => {
    expect(parametroDoEscopo({ tipo: 'eu' })).toBeNull();
    expect(comEscopo('/financas/2026-11/resumo', { tipo: 'eu' })).toBe('/financas/2026-11/resumo');
    expect(comEscopo('/financas/2026-11/resumo', { tipo: 'conjunto' })).toBe('/financas/2026-11/resumo?de=conjunto');
    expect(comEscopo('/financas/parcelamentos', { tipo: 'pessoa', usuarioId: EDUARDO })).toBe('/financas/parcelamentos?de=eduardo');
    expect(chaveDoEscopo({ tipo: 'eu' })).toBe('eu');
    expect(chaveDoEscopo({ tipo: 'conjunto' })).toBe('conjunto');
  });

  it('descobre o dono do escopo', () => {
    expect(donoDoEscopo({ tipo: 'eu' }, MARIANA)).toBe(MARIANA);
    expect(donoDoEscopo({ tipo: 'pessoa', usuarioId: EDUARDO }, MARIANA)).toBe(EDUARDO);
    expect(donoDoEscopo({ tipo: 'conjunto' }, MARIANA)).toBeNull();
  });
});

describe('podeEditarEscopo', () => {
  const acessos: FinancasAcesso[] = [
    { dono_id: EDUARDO, convidado_id: MARIANA, nivel: 'ver' },
    { dono_id: 'terceiro', convidado_id: MARIANA, nivel: 'editar' },
  ];

  it('no meu escopo e no Conjunto sempre pode', () => {
    expect(podeEditarEscopo({ tipo: 'eu' }, MARIANA, [])).toBe(true);
    expect(podeEditarEscopo({ tipo: 'conjunto' }, MARIANA, [])).toBe(true);
  });

  it('na conta de outra pessoa só com acesso editar', () => {
    expect(podeEditarEscopo({ tipo: 'pessoa', usuarioId: EDUARDO }, MARIANA, acessos)).toBe(false);
    expect(podeEditarEscopo({ tipo: 'pessoa', usuarioId: 'terceiro' }, MARIANA, acessos)).toBe(true);
    expect(podeEditarEscopo({ tipo: 'pessoa', usuarioId: 'ninguem' }, MARIANA, acessos)).toBe(false);
  });
});

describe('podeEditarConta', () => {
  const acessos: FinancasAcesso[] = [{ dono_id: EDUARDO, convidado_id: MARIANA, nivel: 'editar' }];

  it('dono e co-dono podem', () => {
    expect(podeEditarConta(conta('m1', MARIANA), MARIANA, [])).toBe(true);
    expect(podeEditarConta(conta('casa', EDUARDO, { conjunta: true, donos: [EDUARDO, MARIANA] }), MARIANA, [])).toBe(true);
  });

  it('com acesso editar do dono pode; sem ele, não', () => {
    expect(podeEditarConta(conta('e1', EDUARDO), MARIANA, acessos)).toBe(true);
    expect(podeEditarConta(conta('e1', EDUARDO), MARIANA, [{ ...acessos[0], nivel: 'ver' }])).toBe(false);
    expect(podeEditarConta(conta('e1', EDUARDO), MARIANA, [])).toBe(false);
    expect(podeEditarConta(conta('e1', EDUARDO), undefined, acessos)).toBe(false);
  });
});

describe('contasDoEscopo e lancamentosDoEscopo', () => {
  it('separa contas individuais das conjuntas', () => {
    expect(contasDoEscopo(contas, { tipo: 'eu' }, MARIANA).map((c) => c.id)).toEqual(['m1']);
    expect(contasDoEscopo(contas, { tipo: 'pessoa', usuarioId: EDUARDO }, MARIANA).map((c) => c.id)).toEqual(['e1']);
    expect(contasDoEscopo(contas, { tipo: 'conjunto' }, MARIANA).map((c) => c.id)).toEqual(['casa']);
  });

  it('o Conjunto só tem contas conjuntas em que eu sou dono', () => {
    expect(contasDoEscopo(contas, { tipo: 'conjunto' }, 'fulano').map((c) => c.id)).toEqual(['outra']);
  });

  it('o Conjunto traz também as despesas divididas, vindas de qualquer conta', () => {
    const lancamentos = [
      lanc('a', 'm1'),
      lanc('b', 'm1', { conjunto: true, conjunto_com: EDUARDO, pagador_id: MARIANA }),
      lanc('c', 'casa'),
      lanc('d', 'e1', { conjunto: true, conjunto_com: MARIANA, pagador_id: EDUARDO }),
      lanc('e', 'e1', { conjunto: true, conjunto_com: 'terceiro', pagador_id: EDUARDO }),
    ];
    expect(lancamentosDoEscopo(lancamentos, contas, { tipo: 'conjunto' }, MARIANA).map((l) => l.id)).toEqual(['b', 'c', 'd']);
    expect(lancamentosDoEscopo(lancamentos, contas, { tipo: 'eu' }, MARIANA).map((l) => l.id)).toEqual(['a', 'b']);
  });
});

describe('partesDoLancamento', () => {
  it('despesa dividida: quem pagou fica com a porcentagem e o outro com o resto', () => {
    const l = lanc('x', 'm1', { valor: 100, conjunto: true, conjunto_com: EDUARDO, pagador_id: MARIANA, divisao_percentual: 60 });
    expect(partesDoLancamento(l, contas[0])).toEqual([
      { usuarioId: MARIANA, valor: 60 },
      { usuarioId: EDUARDO, valor: 40 },
    ]);
  });

  it('não perde centavos', () => {
    const l = lanc('x', 'm1', { valor: 10.01, conjunto: true, conjunto_com: EDUARDO, pagador_id: MARIANA });
    const soma = partesDoLancamento(l, contas[0]).reduce((s, p) => s + Math.round(p.valor * 100), 0);
    expect(soma).toBe(1001);
  });

  it('conta conjunta: partes iguais entre os donos', () => {
    expect(partesDoLancamento(lanc('x', 'casa', { valor: 100.01 }), contas[2])).toEqual([
      { usuarioId: MARIANA, valor: 50.01 },
      { usuarioId: EDUARDO, valor: 50 },
    ]);
  });

  it('conta individual sem divisão não tem partes', () => {
    expect(partesDoLancamento(lanc('x', 'm1'), contas[0])).toEqual([]);
  });
});

describe('calcularAcerto', () => {
  it('quem pagou adiantou a parte do outro', () => {
    const lancamentos = [lanc('a', 'm1', { valor: 100, conjunto: true, conjunto_com: EDUARDO, pagador_id: MARIANA })];
    expect(calcularAcerto(lancamentos)).toEqual([{ devedorId: EDUARDO, credorId: MARIANA, valor: 50 }]);
  });

  it('dívidas em sentidos opostos se compensam', () => {
    const lancamentos = [
      lanc('a', 'm1', { valor: 100, conjunto: true, conjunto_com: EDUARDO, pagador_id: MARIANA }),
      lanc('b', 'e1', { valor: 40, conjunto: true, conjunto_com: MARIANA, pagador_id: EDUARDO }),
    ];
    expect(calcularAcerto(lancamentos)).toEqual([{ devedorId: EDUARDO, credorId: MARIANA, valor: 30 }]);
  });

  it('quando se anulam não sobra acerto', () => {
    const lancamentos = [
      lanc('a', 'm1', { valor: 100, conjunto: true, conjunto_com: EDUARDO, pagador_id: MARIANA }),
      lanc('b', 'e1', { valor: 100, conjunto: true, conjunto_com: MARIANA, pagador_id: EDUARDO }),
    ];
    expect(calcularAcerto(lancamentos)).toEqual([]);
  });

  it('ignora entradas, contas conjuntas e despesas não divididas', () => {
    const lancamentos = [
      lanc('a', 'm1', { tipo: 'entrada', conjunto: true, conjunto_com: EDUARDO, pagador_id: MARIANA }),
      lanc('b', 'casa'),
      lanc('c', 'm1'),
    ];
    expect(calcularAcerto(lancamentos)).toEqual([]);
  });

  it('respeita a porcentagem de quem pagou', () => {
    const lancamentos = [lanc('a', 'm1', { valor: 200, conjunto: true, conjunto_com: EDUARDO, pagador_id: MARIANA, divisao_percentual: 75 })];
    expect(calcularAcerto(lancamentos)).toEqual([{ devedorId: EDUARDO, credorId: MARIANA, valor: 50 }]);
  });
});

describe('escolherRegra', () => {
  const regras = [
    { id: 'outro', dono_id: 'terceiro', ultima_utilizacao: '2026-11-10' },
    { id: 'conjunto', dono_id: null, ultima_utilizacao: '2026-11-01' },
    { id: 'minha', dono_id: MARIANA, ultima_utilizacao: '2026-10-01' },
    { id: 'dele', dono_id: EDUARDO, ultima_utilizacao: '2026-10-05' },
  ];

  it('a do dono da conta vence', () => {
    expect(escolherRegra(regras, EDUARDO, MARIANA)?.id).toBe('dele');
  });

  it('sem a do dono, vale a do Conjunto, depois a minha, depois a dos outros', () => {
    expect(escolherRegra(regras.filter((r) => r.id !== 'dele'), EDUARDO, MARIANA)?.id).toBe('conjunto');
    expect(escolherRegra(regras.filter((r) => r.id === 'minha' || r.id === 'outro'), EDUARDO, MARIANA)?.id).toBe('minha');
    expect(escolherRegra(regras.filter((r) => r.id === 'outro'), EDUARDO, MARIANA)?.id).toBe('outro');
  });

  it('numa conta conjunta (dono nulo) a regra do Conjunto vem primeiro', () => {
    expect(escolherRegra(regras, null, MARIANA)?.id).toBe('conjunto');
  });

  it('entre regras de igual prioridade, a usada por último vence', () => {
    const duas = [
      { id: 'velha', dono_id: 'a', ultima_utilizacao: '2026-01-01' },
      { id: 'nova', dono_id: 'b', ultima_utilizacao: '2026-06-01' },
    ];
    expect(escolherRegra(duas, MARIANA, MARIANA)?.id).toBe('nova');
  });

  it('sem regras, nada', () => {
    expect(escolherRegra([], MARIANA, MARIANA)).toBeUndefined();
  });
});
