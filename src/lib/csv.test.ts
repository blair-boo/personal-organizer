import { describe, expect, it } from 'vitest';
import { gerarCsv, nomeArquivoCsv } from './csv';

interface Linha {
  nome: string | null;
  valor: number | null;
  ativo: boolean;
}

const colunas = [
  { titulo: 'Nome', valor: (l: Linha) => l.nome },
  { titulo: 'Valor', valor: (l: Linha) => l.valor },
  { titulo: 'Ativo', valor: (l: Linha) => l.ativo },
];

describe('gerarCsv', () => {
  it('usa ; como separador, vírgula decimal e quebra de linha CRLF', () => {
    const csv = gerarCsv(colunas, [{ nome: 'Geladeira', valor: 1234.5, ativo: true }]);
    expect(csv).toBe('Nome;Valor;Ativo\r\nGeladeira;1234,5;Sim\r\n');
  });

  it('deixa vazio o que é nulo e escreve Sim/Não nos booleanos', () => {
    const csv = gerarCsv(colunas, [{ nome: null, valor: null, ativo: false }]);
    expect(csv).toBe('Nome;Valor;Ativo\r\n;;Não\r\n');
  });

  it('coloca entre aspas texto com ; aspas ou quebra de linha, duplicando as aspas', () => {
    const csv = gerarCsv(colunas, [{ nome: 'Mesa; "grande"\ncinza', valor: 1, ativo: true }]);
    expect(csv).toBe('Nome;Valor;Ativo\r\n"Mesa; ""grande""\ncinza";1;Sim\r\n');
  });

  it('protege contra fórmula em planilha (texto começando com = + - @)', () => {
    const csv = gerarCsv(colunas, [
      { nome: '=HYPERLINK("x")', valor: 1, ativo: true },
      { nome: '+55 11 9999', valor: 1, ativo: true },
      { nome: '@soma', valor: 1, ativo: true },
    ]);
    const linhas = csv.split('\r\n');
    expect(linhas[1]).toBe(`"'=HYPERLINK(""x"")";1;Sim`);
    expect(linhas[2]).toBe("'+55 11 9999;1;Sim");
    expect(linhas[3]).toBe("'@soma;1;Sim");
  });

  it('números negativos continuam números', () => {
    expect(gerarCsv(colunas, [{ nome: 'x', valor: -5.25, ativo: true }])).toContain('x;-5,25;Sim');
  });

  it('lista vazia gera só o cabeçalho', () => {
    expect(gerarCsv(colunas, [])).toBe('Nome;Valor;Ativo\r\n');
  });
});

describe('nomeArquivoCsv', () => {
  it('tira acento e espaço e põe a data', () => {
    expect(nomeArquivoCsv('Itens do Apartamento', '2026-10-09')).toBe('itens-do-apartamento_2026-10-09.csv');
    expect(nomeArquivoCsv('Manutenção', '2026-10-09')).toBe('manutencao_2026-10-09.csv');
    expect(nomeArquivoCsv('???', '2026-10-09')).toBe('exportacao_2026-10-09.csv');
  });
});
