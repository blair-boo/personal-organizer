import type { Documento, PessoaDocumentos } from '../types';

/** Por que um documento aparece como pendente. */
export type MotivoPendencia = 'sem_preenchimento' | 'vencido';

export type DadosPendencia = Pick<Documento, 'numero' | 'numero_espelho' | 'emissao' | 'vencimento_tipo' | 'vencimento_data' | 'vencimento_calculada'>;

/** Documento pessoal sem número, espelho, emissão nem tipo de vencimento: ainda não foi preenchido. */
export function semPreenchimento(d: Pick<Documento, 'numero' | 'numero_espelho' | 'emissao' | 'vencimento_tipo'>): boolean {
  return !d.numero && !d.numero_espelho && !d.emissao && !d.vencimento_tipo;
}

/** Vencimento "indeterminado" nunca vence; documento sem data de vencimento também não. */
export function estaVencido(d: Pick<Documento, 'vencimento_tipo' | 'vencimento_data' | 'vencimento_calculada'>, hoje: string): boolean {
  if (!d.vencimento_tipo || d.vencimento_tipo === 'indeterminado') return false;
  const data = d.vencimento_calculada ?? (d.vencimento_tipo === 'data' ? d.vencimento_data : null);
  return !!data && data < hoje;
}

/** Motivo da pendência de um documento pessoal, ou null se está em dia. A pendência é calculada dos dados: preencher ou renovar a faz sumir, e vencer a traz de volta. */
export function motivoPendencia(d: DadosPendencia, hoje: string): MotivoPendencia | null {
  if (estaVencido(d, hoje)) return 'vencido';
  if (semPreenchimento(d)) return 'sem_preenchimento';
  return null;
}

export const ROTULO_PENDENCIA: Record<MotivoPendencia, string> = {
  sem_preenchimento: 'sem preenchimento',
  vencido: 'vencido',
};

export interface DocumentoParaPendencia extends DadosPendencia {
  id: string;
  area: Documento['area'];
  pessoa_id: string | null;
  titulo: string;
  ordem: number;
  /** Quantos campos livres do documento foram criados mas estão sem conteúdo. */
  qtdCamposVazios: number;
}

export interface ItemPendente {
  id: string;
  titulo: string;
  motivo: MotivoPendencia;
}

export interface GrupoPendentes {
  pessoaId: string;
  nome: string;
  itens: ItemPendente[];
}

/** Pendências dos documentos pessoais, um grupo por pessoa (e pelo casal), na ordem das pessoas. Todos veem tudo. */
export function pendenciasPessoais(documentos: DocumentoParaPendencia[], pessoas: PessoaDocumentos[], hoje: string): GrupoPendentes[] {
  const doGrupo = new Map<string, DocumentoParaPendencia[]>();
  for (const d of documentos) {
    if (d.area !== 'pessoais' || !d.pessoa_id) continue;
    doGrupo.set(d.pessoa_id, [...(doGrupo.get(d.pessoa_id) ?? []), d]);
  }
  return pessoas.map((p) => {
    const itens: ItemPendente[] = [];
    for (const d of [...(doGrupo.get(p.id) ?? [])].sort((a, b) => a.ordem - b.ordem || a.titulo.localeCompare(b.titulo))) {
      const motivo = motivoPendencia(d, hoje);
      if (motivo) itens.push({ id: d.id, titulo: d.titulo, motivo });
    }
    return { pessoaId: p.id, nome: p.nome, itens };
  });
}

/** Documentos de Apartamento com algum campo criado e ainda sem conteúdo (eles não têm número nem vencimento). */
export function pendenciasApartamento(documentos: DocumentoParaPendencia[]): ItemPendente[] {
  return documentos
    .filter((d) => d.area === 'apartamento' && d.qtdCamposVazios > 0)
    .sort((a, b) => a.ordem - b.ordem || a.titulo.localeCompare(b.titulo))
    .map((d) => ({ id: d.id, titulo: d.titulo, motivo: 'sem_preenchimento' as const }));
}
