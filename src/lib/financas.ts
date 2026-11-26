import type { Conta, FinancasAcesso, Lancamento, NivelAcessoFinancas } from '../types';

/**
 * Escopo de Finanças: de quem são os números na tela.
 *  - eu: as minhas contas individuais.
 *  - pessoa: as contas individuais de outro login que liberou o acesso para mim.
 *  - conjunto: contas conjuntas e despesas marcadas como conjuntas.
 * Vai na URL (`?de=`): ausente é "eu", "conjunto" é o Conjunto e qualquer outro valor é o id do login.
 */
export type EscopoFinancas = { tipo: 'eu' } | { tipo: 'pessoa'; usuarioId: string } | { tipo: 'conjunto' };

export const PARAMETRO_ESCOPO = 'de';
const VALOR_CONJUNTO = 'conjunto';

export function escopoDoParametro(valor: string | null, meuId: string | undefined): EscopoFinancas {
  if (!valor || valor === 'eu') return { tipo: 'eu' };
  if (valor === VALOR_CONJUNTO) return { tipo: 'conjunto' };
  if (valor === meuId) return { tipo: 'eu' };
  return { tipo: 'pessoa', usuarioId: valor };
}

/** Valor para a URL; null quando é o escopo padrão (eu). */
export function parametroDoEscopo(escopo: EscopoFinancas): string | null {
  if (escopo.tipo === 'conjunto') return VALOR_CONJUNTO;
  if (escopo.tipo === 'pessoa') return escopo.usuarioId;
  return null;
}

/** Acrescenta o escopo a um caminho (`?de=...`), mantendo o caminho limpo no escopo padrão. */
export function comEscopo(caminho: string, escopo: EscopoFinancas): string {
  const valor = parametroDoEscopo(escopo);
  return valor ? `${caminho}?${PARAMETRO_ESCOPO}=${encodeURIComponent(valor)}` : caminho;
}

/** Texto curto e estável para entrar em queryKey. */
export function chaveDoEscopo(escopo: EscopoFinancas): string {
  return parametroDoEscopo(escopo) ?? 'eu';
}

/** Dono das contas do escopo. Nulo no Conjunto, que não tem um dono só. */
export function donoDoEscopo(escopo: EscopoFinancas, meuId: string | undefined): string | null {
  if (escopo.tipo === 'conjunto') return null;
  return escopo.tipo === 'pessoa' ? escopo.usuarioId : (meuId ?? null);
}

/** Posso criar e editar neste escopo? No meu e no Conjunto sim; no de outra pessoa só com acesso "editar". */
export function podeEditarEscopo(escopo: EscopoFinancas, meuId: string | undefined, acessos: FinancasAcesso[]): boolean {
  if (escopo.tipo !== 'pessoa') return true;
  return acessos.some((a) => a.dono_id === escopo.usuarioId && a.convidado_id === meuId && a.nivel === 'editar');
}

/** Posso alterar esta conta? Sendo dono ou co-dono, ou com acesso "editar" do dono. */
export function podeEditarConta(conta: Conta, meuId: string | undefined, acessos: FinancasAcesso[]): boolean {
  if (!meuId) return false;
  if (conta.dono_id === meuId || conta.donos.includes(meuId)) return true;
  return acessos.some((a) => a.dono_id === conta.dono_id && a.convidado_id === meuId && a.nivel === 'editar');
}

/** Logins que liberaram as finanças para mim, com o nível de cada um. */
export function pessoasQueLiberaram(acessos: FinancasAcesso[], meuId: string | undefined): { usuarioId: string; nivel: NivelAcessoFinancas }[] {
  return acessos.filter((a) => a.convidado_id === meuId).map((a) => ({ usuarioId: a.dono_id, nivel: a.nivel }));
}

export function contasDoEscopo(contas: Conta[], escopo: EscopoFinancas, meuId: string | undefined): Conta[] {
  if (escopo.tipo === 'conjunto') return contas.filter((c) => c.conjunta && !!meuId && c.donos.includes(meuId));
  const dono = donoDoEscopo(escopo, meuId);
  return contas.filter((c) => !c.conjunta && c.dono_id === dono);
}

/** Despesa conjunta que veio de uma conta individual (a de quem pagou ou a de quem divide). */
export function ehDespesaDividida(l: Lancamento): boolean {
  return l.conjunto && !!l.conjunto_com;
}

export function lancamentosDoEscopo(lancamentos: Lancamento[], contas: Conta[], escopo: EscopoFinancas, meuId: string | undefined): Lancamento[] {
  const idsDasContas = new Set(contasDoEscopo(contas, escopo, meuId).map((c) => c.id));
  if (escopo.tipo !== 'conjunto') return lancamentos.filter((l) => idsDasContas.has(l.conta_id));
  return lancamentos.filter(
    (l) => idsDasContas.has(l.conta_id) || (ehDespesaDividida(l) && (l.conjunto_com === meuId || l.pagador_id === meuId))
  );
}

function emCentavos(valor: number): number {
  return Math.round(valor * 100);
}

export interface ParteDoLancamento {
  usuarioId: string;
  /** Quanto cabe a essa pessoa, em reais. */
  valor: number;
}

/**
 * Como um lançamento do Conjunto se divide entre as pessoas.
 *  - Despesa dividida: quem pagou fica com `divisao_percentual`, a outra pessoa com o resto.
 *  - Conta conjunta: partes iguais entre os donos (sobra de centavos vai para o primeiro).
 * Devolve lista vazia quando não dá para saber quem participa.
 */
export function partesDoLancamento(lancamento: Lancamento, conta: Conta | undefined): ParteDoLancamento[] {
  const total = emCentavos(lancamento.valor);
  if (ehDespesaDividida(lancamento) && lancamento.pagador_id && lancamento.conjunto_com) {
    const doOutro = Math.round((total * (100 - lancamento.divisao_percentual)) / 100);
    return [
      { usuarioId: lancamento.pagador_id, valor: (total - doOutro) / 100 },
      { usuarioId: lancamento.conjunto_com, valor: doOutro / 100 },
    ];
  }
  const donos = conta?.conjunta ? conta.donos : [];
  if (donos.length === 0) return [];
  const base = Math.floor(total / donos.length);
  const sobra = total - base * donos.length;
  return donos.map((usuarioId, i) => ({ usuarioId, valor: (base + (i === 0 ? sobra : 0)) / 100 }));
}

export interface Acerto {
  devedorId: string;
  credorId: string;
  valor: number;
}

/**
 * Quem deve quanto a quem, só pelas despesas divididas (saídas). Quem pagou adiantou a parte
 * da outra pessoa. Lançamentos de conta conjunta não entram: saem de uma conta dos dois.
 * Dívidas em sentidos opostos entre o mesmo par se compensam.
 */
export function calcularAcerto(lancamentos: Lancamento[]): Acerto[] {
  const saldoPorPar = new Map<string, number>();
  for (const l of lancamentos) {
    if (l.tipo !== 'saida' || !ehDespesaDividida(l) || !l.pagador_id || !l.conjunto_com) continue;
    const total = emCentavos(l.valor);
    const doOutro = Math.round((total * (100 - l.divisao_percentual)) / 100);
    if (doOutro === 0 || l.pagador_id === l.conjunto_com) continue;
    const [a, b] = [l.pagador_id, l.conjunto_com].sort();
    // Saldo do par (a, b): positivo quando b deve a a.
    const chave = `${a}|${b}`;
    saldoPorPar.set(chave, (saldoPorPar.get(chave) ?? 0) + (l.pagador_id === a ? doOutro : -doOutro));
  }
  const acertos: Acerto[] = [];
  for (const [chave, saldo] of saldoPorPar) {
    if (saldo === 0) continue;
    const [a, b] = chave.split('|');
    acertos.push(saldo > 0 ? { devedorId: b, credorId: a, valor: saldo / 100 } : { devedorId: a, credorId: b, valor: -saldo / 100 });
  }
  return acertos;
}

/**
 * Entre as regras do banco de lançamentos que a pessoa enxerga, escolhe a que vale:
 * primeiro a do dono da conta, depois a do Conjunto (dono nulo), depois a minha,
 * depois a de quem compartilhou comigo (a usada por último vence).
 */
export function escolherRegra<T extends { dono_id: string | null; ultima_utilizacao: string }>(
  regras: T[],
  donoDaConta: string | null,
  meuId: string | undefined
): T | undefined {
  const prioridade = (r: T): number => {
    if (r.dono_id === donoDaConta) return 0;
    if (r.dono_id === null) return 1;
    if (r.dono_id === meuId) return 2;
    return 3;
  };
  return [...regras].sort((x, y) => prioridade(x) - prioridade(y) || y.ultima_utilizacao.localeCompare(x.ultima_utilizacao))[0];
}
