import { somarDias } from './datas';
import type { Gato, GatoPeso, GatoVacina, GatoVermifugo } from '../types';

function partes(iso: string): { ano: number; mes: number; dia: number } {
  const [ano, mes, dia] = iso.split('-').map(Number);
  return { ano, mes, dia };
}

/** Dias entre duas datas "AAAA-MM-DD" (b - a). */
export function diasEntre(a: string, b: string): number {
  const x = partes(a);
  const y = partes(b);
  return Math.round((Date.UTC(y.ano, y.mes - 1, y.dia) - Date.UTC(x.ano, x.mes - 1, x.dia)) / 86400000);
}

/** Idade em texto: "20 dias", "5 meses", "2 anos e 3 meses". null se não há nascimento ou ele é no futuro. */
export function idadeDoGato(nascimento: string | null, hoje: string): string | null {
  if (!nascimento || nascimento > hoje) return null;
  const n = partes(nascimento);
  const h = partes(hoje);
  let meses = (h.ano - n.ano) * 12 + (h.mes - n.mes);
  if (h.dia < n.dia) meses--;
  if (meses < 1) {
    const dias = diasEntre(nascimento, hoje);
    return dias === 1 ? '1 dia' : `${dias} dias`;
  }
  const anos = Math.floor(meses / 12);
  const resto = meses % 12;
  const textoMeses = resto === 1 ? '1 mês' : `${resto} meses`;
  if (anos === 0) return textoMeses;
  const textoAnos = anos === 1 ? '1 ano' : `${anos} anos`;
  return resto === 0 ? textoAnos : `${textoAnos} e ${textoMeses}`;
}

export type TipoProxima = 'vacina' | 'vermifugo';

export interface ProximaData {
  gatoId: string;
  gatoNome: string;
  tipo: TipoProxima;
  titulo: string;
  data: string;
  /** Dias até a data (negativo = já passou). */
  dias: number;
  vencida: boolean;
  /** Vence em até 30 dias (e ainda não passou). */
  emBreve: boolean;
}

const DIAS_EM_BREVE = 30;

function chaveDaVacina(v: Pick<GatoVacina, 'gato_id' | 'vacina'>): string {
  return `${v.gato_id}|${v.vacina.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim()}`;
}

/**
 * Próximas vacinas e vermífugos de todos os gatos, em ordem de data. De cada
 * vacina conta só a aplicação mais recente (as de antes já foram superadas); do
 * vermífugo, a mais recente de cada gato, qualquer que seja o produto.
 */
export function proximasDatas(gatos: Gato[], vacinas: GatoVacina[], vermifugos: GatoVermifugo[], hoje: string): ProximaData[] {
  const nomePorGato = new Map(gatos.map((g) => [g.id, g.nome]));
  const monta = (gatoId: string, tipo: TipoProxima, titulo: string, data: string): ProximaData | null => {
    const gatoNome = nomePorGato.get(gatoId);
    if (!gatoNome) return null;
    const dias = diasEntre(hoje, data);
    return { gatoId, gatoNome, tipo, titulo, data, dias, vencida: dias < 0, emBreve: dias >= 0 && dias <= DIAS_EM_BREVE };
  };

  const ultimaVacina = new Map<string, GatoVacina>();
  for (const v of vacinas) {
    const atual = ultimaVacina.get(chaveDaVacina(v));
    if (!atual || v.data > atual.data) ultimaVacina.set(chaveDaVacina(v), v);
  }
  const ultimoVermifugo = new Map<string, GatoVermifugo>();
  for (const v of vermifugos) {
    const atual = ultimoVermifugo.get(v.gato_id);
    if (!atual || v.data > atual.data) ultimoVermifugo.set(v.gato_id, v);
  }

  const lista: ProximaData[] = [];
  for (const v of ultimaVacina.values()) {
    const p = v.proxima_data ? monta(v.gato_id, 'vacina', v.vacina, v.proxima_data) : null;
    if (p) lista.push(p);
  }
  for (const v of ultimoVermifugo.values()) {
    const p = v.proxima_data ? monta(v.gato_id, 'vermifugo', `Vermífugo (${v.produto})`, v.proxima_data) : null;
    if (p) lista.push(p);
  }
  return lista.sort((a, b) => a.data.localeCompare(b.data) || a.gatoNome.localeCompare(b.gatoNome, 'pt-BR') || a.titulo.localeCompare(b.titulo, 'pt-BR'));
}

/** Texto de quanto falta: "em 12 dias", "hoje", "amanhã", "há 3 dias". */
export function textoDeDias(dias: number): string {
  if (dias === 0) return 'hoje';
  if (dias === 1) return 'amanhã';
  if (dias === -1) return 'ontem';
  return dias > 0 ? `em ${dias} dias` : `há ${-dias} dias`;
}

/** Variação do peso em relação à pesagem anterior (kg), por id; a mais antiga não tem. */
export function variacoesDePeso(pesos: GatoPeso[]): Map<string, number> {
  const ordenados = [...pesos].sort((a, b) => a.data.localeCompare(b.data) || a.criado_em.localeCompare(b.criado_em));
  const variacoes = new Map<string, number>();
  for (let i = 1; i < ordenados.length; i++) {
    variacoes.set(ordenados[i].id, Math.round((Number(ordenados[i].peso_kg) - Number(ordenados[i - 1].peso_kg)) * 100) / 100);
  }
  return variacoes;
}

export function formatarKg(valor: number): string {
  return `${valor.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} kg`;
}

export function formatarVariacaoKg(valor: number): string {
  const sinal = valor > 0 ? '+' : valor < 0 ? '-' : '';
  return `${sinal}${Math.abs(valor).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} kg`;
}

/** Lembrete do calendário: quantos dias antes da data o aviso toca. */
export const DIAS_DE_AVISO_NO_CALENDARIO = 3;

/** Data do aviso (para conferir o cálculo do calendário). */
export function dataDoAviso(data: string): string {
  return somarDias(data, -DIAS_DE_AVISO_NO_CALENDARIO);
}

/** Quantas vacinas e vermífugos já passaram da data (para o aviso no cabeçalho). */
export function contarVencidas(proximas: ProximaData[]): number {
  return proximas.filter((p) => p.vencida).length;
}

export interface PontoDoGrafico {
  id: string;
  data: string;
  kg: number;
  x: number;
  y: number;
}

export interface GraficoDePeso {
  pontos: PontoDoGrafico[];
  /** Linha do gráfico em formato "x,y x,y ...". */
  linha: string;
  minimoKg: number;
  maximoKg: number;
}

/**
 * Posição de cada pesagem num gráfico de linha (SVG) de largura x altura, com
 * margem. O eixo de x segue o tempo real entre as datas; o de y, o intervalo de
 * pesos com uma folga. Menos de 2 pesagens não formam tendência: devolve null.
 */
export function graficoDePeso(pesos: GatoPeso[], largura: number, altura: number, margem = 12): GraficoDePeso | null {
  if (pesos.length < 2) return null;
  const ordenados = [...pesos].sort((a, b) => a.data.localeCompare(b.data) || a.criado_em.localeCompare(b.criado_em));
  const primeira = ordenados[0].data;
  const total = Math.max(1, diasEntre(primeira, ordenados[ordenados.length - 1].data));
  const kgs = ordenados.map((p) => Number(p.peso_kg));
  const minimo = Math.min(...kgs);
  const maximo = Math.max(...kgs);
  const folga = maximo === minimo ? 0.5 : (maximo - minimo) * 0.15;
  const piso = minimo - folga;
  const teto = maximo + folga;
  const pontos = ordenados.map((p, i): PontoDoGrafico => {
    const arredonda = (n: number) => Math.round(n * 10) / 10;
    return {
      id: p.id,
      data: p.data,
      kg: kgs[i],
      x: arredonda(margem + (diasEntre(primeira, p.data) / total) * (largura - 2 * margem)),
      y: arredonda(margem + (1 - (kgs[i] - piso) / (teto - piso)) * (altura - 2 * margem)),
    };
  });
  return { pontos, linha: pontos.map((p) => `${p.x},${p.y}`).join(' '), minimoKg: minimo, maximoKg: maximo };
}
