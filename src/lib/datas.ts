const MESES = [
  'janeiro',
  'fevereiro',
  'março',
  'abril',
  'maio',
  'junho',
  'julho',
  'agosto',
  'setembro',
  'outubro',
  'novembro',
  'dezembro',
];

/** Competência do mês atual no formato "AAAA-MM". */
export function competenciaAtual(): string {
  const hoje = new Date();
  return `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, '0')}`;
}

/** Soma (ou subtrai, com delta negativo) meses a uma competência "AAAA-MM". */
export function somarMeses(competencia: string, delta: number): string {
  const [ano, mes] = competencia.split('-').map(Number);
  const data = new Date(ano, mes - 1 + delta, 1);
  return `${data.getFullYear()}-${String(data.getMonth() + 1).padStart(2, '0')}`;
}

/** Formata "AAAA-MM" como "Janeiro de 2026". */
export function formatarCompetenciaExtenso(competencia: string): string {
  const [ano, mes] = competencia.split('-').map(Number);
  const nome = MESES[mes - 1] ?? '';
  return `${nome.charAt(0).toUpperCase()}${nome.slice(1)} de ${ano}`;
}

/** Converte "AAAA-MM" pra sigla curta "AA-MM" usada nos nomes de arquivo salvos no Storage. */
export function competenciaParaSigla(competencia: string): string {
  const [ano, mes] = competencia.split('-');
  return `${ano.slice(2)}-${mes}`;
}

/** Data (dia 1) correspondente à competência, pra gravar em colunas `date` do Postgres. */
export function competenciaParaData(competencia: string): string {
  return `${competencia}-01`;
}

export function formatarMoeda(valor: number): string {
  return valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

/** Soma (ou subtrai) dias a uma data "AAAA-MM-DD", retornando outra "AAAA-MM-DD". */
export function somarDias(dataIso: string, dias: number): string {
  const [ano, mes, dia] = dataIso.split('-').map(Number);
  const data = new Date(ano, mes - 1, dia + dias);
  return `${data.getFullYear()}-${String(data.getMonth() + 1).padStart(2, '0')}-${String(data.getDate()).padStart(2, '0')}`;
}

/** Data de hoje no formato "AAAA-MM-DD" (fuso local). */
export function hojeIso(): string {
  const hoje = new Date();
  return `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, '0')}-${String(hoje.getDate()).padStart(2, '0')}`;
}

export function formatarData(iso: string): string {
  const [ano, mes, dia] = iso.split('-');
  return `${dia}/${mes}/${ano}`;
}
