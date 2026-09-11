import type { TipoLancamento } from '../types';

export interface LancamentoCandidato {
  data: string; // "AAAA-MM-DD"
  descricaoOriginal: string;
  valor: number;
  tipo: TipoLancamento;
  parcelaAtual: number | null;
  parcelaTotal: number | null;
}

// Linha típica de extrato/fatura: "DD/MM[/AAAA]  descrição livre  [R$] [-]1.234,56".
const RE_LINHA = /^(\d{2}\/\d{2}(?:\/\d{2,4})?)\s+(.+?)\s+(\(?-?\s?R?\$?\s?-?[\d.]+,\d{2}\)?)$/;
const RE_PARCELA = /(\d{1,2})\s*\/\s*(\d{1,2})\s*$/;

function paraNumero(valorTexto: string): number {
  const negativo = /^\s*-/.test(valorTexto) || valorTexto.includes('(');
  const limpo = valorTexto.replace(/[^\d,]/g, '').replace(',', '.');
  const numero = parseFloat(limpo);
  return negativo ? -numero : numero;
}

function paraIso(dataTexto: string, anoReferencia: number): string {
  const partes = dataTexto.split('/');
  const dia = partes[0].padStart(2, '0');
  const mes = partes[1].padStart(2, '0');
  let ano = partes[2] ? Number(partes[2]) : anoReferencia;
  if (ano < 100) ano += 2000;
  return `${ano}-${mes}-${dia}`;
}

export interface OpcoesParser {
  /** Ano usado quando a linha só tem "DD/MM" (fatura/extrato costuma omitir o ano). */
  anoReferencia: number;
  /**
   * Fatura de cartão: valor positivo = compra (saída), negativo = estorno/pagamento (entrada).
   * Extrato de conta: valor positivo = entrada, negativo = saída (convenção padrão de banco).
   */
  contaEhCartao: boolean;
}

/**
 * Parser genérico (heurístico) de linhas de extrato/fatura extraídas de PDF.
 * Layout varia muito de banco pra banco — por isso o resultado sempre passa
 * por uma tela de revisão antes de ser salvo, nunca é gravado direto.
 */
export function parseLinhasExtrato(texto: string, opcoes: OpcoesParser): LancamentoCandidato[] {
  const candidatos: LancamentoCandidato[] = [];
  for (const linhaBruta of texto.split('\n')) {
    const linha = linhaBruta.trim();
    if (!linha) continue;
    const match = linha.match(RE_LINHA);
    if (!match) continue;
    const [, dataTexto, descricaoTexto, valorTexto] = match;

    const valorComSinal = paraNumero(valorTexto);
    const negativo = valorComSinal < 0;
    const tipo: TipoLancamento = opcoes.contaEhCartao
      ? negativo
        ? 'entrada'
        : 'saida'
      : negativo
        ? 'saida'
        : 'entrada';

    const matchParcela = descricaoTexto.match(RE_PARCELA);

    candidatos.push({
      data: paraIso(dataTexto, opcoes.anoReferencia),
      descricaoOriginal: descricaoTexto.trim(),
      valor: Math.abs(valorComSinal),
      tipo,
      parcelaAtual: matchParcela ? Number(matchParcela[1]) : null,
      parcelaTotal: matchParcela ? Number(matchParcela[2]) : null,
    });
  }
  return candidatos;
}
