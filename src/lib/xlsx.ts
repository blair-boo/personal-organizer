import writeExcelFile, { type Cell, type Sheet, type SheetData } from 'write-excel-file/browser';
import type { Celula, EstiloCelula, Grade } from './exportacaoTarefas';

/** Cores do Esqueleto: DUE (verde), OVERDUE (vermelho) e as linhas cinza dos blocos. */
const VERDE = '#92C47C';
const VERMELHO = '#E54C4C';
const CINZA = '#CCCCCC';

type Estilo = Record<string, unknown>;

const ESTILOS: Record<EstiloCelula, Estilo> = {
  titulo: { fontWeight: 'bold', fontSize: 12, align: 'left' },
  legendaDue: { backgroundColor: VERDE, fontWeight: 'bold', align: 'center' },
  legendaOver: { backgroundColor: VERMELHO, textColor: '#FFFFFF', fontWeight: 'bold', align: 'center' },
  rotuloMes: { fontWeight: 'bold', fontSize: 12, align: 'left' },
  diaDaSemana: { fontSize: 8, textColor: '#666666', align: 'center' },
  bloco: { backgroundColor: CINZA, fontWeight: 'bold', align: 'left' },
  blocoColuna: { backgroundColor: CINZA, fontWeight: 'bold', align: 'center' },
  nome: { align: 'left' },
  due: { backgroundColor: VERDE, align: 'center' },
  over: { backgroundColor: VERMELHO, textColor: '#FFFFFF', align: 'center' },
  vazia: {},
  dadosCabecalho: { backgroundColor: CINZA, fontWeight: 'bold', align: 'left' },
  dado: { align: 'left', wrap: true, alignVertical: 'top' },
};

function converter(celula: Celula | undefined): Cell {
  if (!celula || celula.valor === null) return celula && Object.keys(ESTILOS[celula.estilo]).length > 0 ? ({ value: '', ...ESTILOS[celula.estilo] } as Cell) : null;
  const base = ESTILOS[celula.estilo];
  if (celula.valor instanceof Date) return { value: celula.valor, type: Date, format: 'mmm.-yy', ...base } as Cell;
  return { value: celula.valor, ...base } as Cell;
}

export interface PlanilhaParaEscrever {
  nome: string;
  grade: Grade;
  /** Largura da primeira coluna e das demais, em caracteres. */
  larguras: { primeira: number; demais: number };
  /** Quantas colunas escrever (o cabeçalho de cada aba define). */
  colunas: number;
}

function larguraDasColunas(p: PlanilhaParaEscrever) {
  return Array.from({ length: p.colunas }, (_, i) => ({ width: i === 0 ? p.larguras.primeira : p.larguras.demais }));
}

/** Escreve as abas num .xlsx (Arial 10, como o Esqueleto) e devolve o arquivo. */
export async function escreverXlsx(planilhas: PlanilhaParaEscrever[]): Promise<Blob> {
  const abas: Sheet<Blob>[] = planilhas.map((p) => ({
    sheet: p.nome,
    data: p.grade.map((linha) => Array.from({ length: p.colunas }, (_, i) => converter(linha[i]))) as SheetData,
    columns: larguraDasColunas(p),
    stickyColumnsCount: 1,
  }));
  return writeExcelFile(abas, { fontFamily: 'Arial', fontSize: 10 }).toBlob();
}
