import { hojeIso } from './datas';

export interface ColunaCsv<T> {
  titulo: string;
  valor: (linha: T) => string | number | boolean | null | undefined;
}

// Ponto e vírgula e vírgula decimal: o Excel em português só abre o CSV em colunas assim.
const SEPARADOR = ';';
const QUEBRA_DE_LINHA = '\r\n';

function celula(valor: string | number | boolean | null | undefined): string {
  if (valor === null || valor === undefined) return '';
  if (typeof valor === 'number') return Number.isFinite(valor) ? String(valor).replace('.', ',') : '';
  let texto = typeof valor === 'boolean' ? (valor ? 'Sim' : 'Não') : valor;
  // Planilhas executam texto que começa com = + - @ como fórmula; o apóstrofo força texto.
  if (/^[=+\-@\t\r]/.test(texto)) texto = `'${texto}`;
  if (/[;"\r\n]/.test(texto)) texto = `"${texto.replace(/"/g, '""')}"`;
  return texto;
}

/** CSV (sem BOM) de uma lista, com uma coluna por `colunas`. A primeira linha é o cabeçalho. */
export function gerarCsv<T>(colunas: ColunaCsv<T>[], linhas: T[]): string {
  const cabecalho = colunas.map((c) => celula(c.titulo)).join(SEPARADOR);
  const corpo = linhas.map((linha) => colunas.map((c) => celula(c.valor(linha))).join(SEPARADOR));
  return [cabecalho, ...corpo].join(QUEBRA_DE_LINHA) + QUEBRA_DE_LINHA;
}

/** Nome do arquivo: `<base>_AAAA-MM-DD.csv`, sem acento nem espaço. */
export function nomeArquivoCsv(base: string, dataIso: string): string {
  const limpo = base
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return `${limpo || 'exportacao'}_${dataIso}.csv`;
}

/** Baixa o CSV no aparelho. O BOM no começo faz o Excel reconhecer UTF-8 (acentos). */
export function baixarCsv(base: string, conteudo: string): void {
  const blob = new Blob(['﻿', conteudo], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = nomeArquivoCsv(base, hojeIso());
  link.click();
  URL.revokeObjectURL(url);
}
