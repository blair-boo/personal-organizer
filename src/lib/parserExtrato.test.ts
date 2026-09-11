import { describe, expect, it } from 'vitest';
import { parseLinhasExtrato } from './parserExtrato';

describe('parseLinhasExtrato — extrato de conta corrente', () => {
  const opcoes = { anoReferencia: 2026, contaEhCartao: false };

  it('reconhece entrada (valor positivo)', () => {
    const [c] = parseLinhasExtrato('05/01 PIX RECEBIDO JOAO 1.500,00', opcoes);
    expect(c).toMatchObject({ data: '2026-01-05', descricaoOriginal: 'PIX RECEBIDO JOAO', valor: 1500, tipo: 'entrada' });
  });

  it('reconhece saída (valor negativo)', () => {
    const [c] = parseLinhasExtrato('06/01 PAGAMENTO BOLETO -230,50', opcoes);
    expect(c).toMatchObject({ valor: 230.5, tipo: 'saida' });
  });

  it('ignora linhas sem o formato esperado', () => {
    const candidatos = parseLinhasExtrato('SALDO ANTERIOR\nExtrato gerado em 01/01/2026', opcoes);
    expect(candidatos).toHaveLength(0);
  });
});

describe('parseLinhasExtrato — fatura de cartão', () => {
  const opcoes = { anoReferencia: 2026, contaEhCartao: true };

  it('compra normal é saída', () => {
    const [c] = parseLinhasExtrato('10/01 AMAZON BR 199,90', opcoes);
    expect(c).toMatchObject({ valor: 199.9, tipo: 'saida' });
  });

  it('estorno/pagamento (negativo) é entrada', () => {
    const [c] = parseLinhasExtrato('12/01 PAGAMENTO RECEBIDO -500,00', opcoes);
    expect(c).toMatchObject({ tipo: 'entrada' });
  });

  it('detecta parcela no final da descrição', () => {
    const [c] = parseLinhasExtrato('15/01 LOJA XPTO 03/12 89,00', opcoes);
    expect(c).toMatchObject({ parcelaAtual: 3, parcelaTotal: 12 });
  });

  it('usa o ano de referência quando a data não tem ano', () => {
    const [c] = parseLinhasExtrato('01/12 COMPRA FIM DE ANO 50,00', { anoReferencia: 2025, contaEhCartao: true });
    expect(c.data).toBe('2025-12-01');
  });
});
