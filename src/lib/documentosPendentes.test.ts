import { describe, expect, it } from 'vitest';
import { estaVencido, motivoPendencia, pendenciasApartamento, pendenciasPessoais, semPreenchimento, type DocumentoParaPendencia } from './documentosPendentes';
import type { PessoaDocumentos } from '../types';

const HOJE = '2026-11-26';

const vazio = { numero: null, numero_espelho: null, emissao: null, vencimento_tipo: null, vencimento_data: null, vencimento_calculada: null };

function doc(id: string, pessoa: string | null, extra: Partial<DocumentoParaPendencia> = {}): DocumentoParaPendencia {
  return { id, area: 'pessoais', pessoa_id: pessoa, titulo: id, ordem: 0, qtdCamposVazios: 0, ...vazio, ...extra };
}

const pessoa = (id: string, nome: string, tipo: 'pessoa' | 'casal' = 'pessoa'): PessoaDocumentos => ({ id, nome, tipo, ordem: 0, usuario_id: null }) as PessoaDocumentos;

describe('semPreenchimento', () => {
  it('é verdade só quando número, espelho, emissão e tipo de vencimento estão vazios', () => {
    expect(semPreenchimento(vazio)).toBe(true);
    expect(semPreenchimento({ ...vazio, numero: '123' })).toBe(false);
    expect(semPreenchimento({ ...vazio, vencimento_tipo: 'indeterminado' })).toBe(false);
  });
});

describe('estaVencido', () => {
  it('vence quando a data calculada ficou para trás', () => {
    expect(estaVencido({ vencimento_tipo: 'data', vencimento_data: '2026-11-01', vencimento_calculada: '2026-11-01' }, HOJE)).toBe(true);
  });
  it('não vence no próprio dia nem depois', () => {
    expect(estaVencido({ vencimento_tipo: 'data', vencimento_data: HOJE, vencimento_calculada: HOJE }, HOJE)).toBe(false);
    expect(estaVencido({ vencimento_tipo: 'prazo', vencimento_data: null, vencimento_calculada: '2027-01-01' }, HOJE)).toBe(false);
  });
  it('indeterminado nunca vence, mesmo com data antiga guardada', () => {
    expect(estaVencido({ vencimento_tipo: 'indeterminado', vencimento_data: '2020-01-01', vencimento_calculada: '2020-01-01' }, HOJE)).toBe(false);
  });
  it('usa a data informada quando a calculada não foi guardada', () => {
    expect(estaVencido({ vencimento_tipo: 'data', vencimento_data: '2026-01-01', vencimento_calculada: null }, HOJE)).toBe(true);
  });
  it('sem tipo de vencimento não vence', () => {
    expect(estaVencido({ vencimento_tipo: null, vencimento_data: null, vencimento_calculada: null }, HOJE)).toBe(false);
  });
});

describe('motivoPendencia', () => {
  it('sem preenchimento, vencido ou em dia', () => {
    expect(motivoPendencia(vazio, HOJE)).toBe('sem_preenchimento');
    expect(motivoPendencia({ ...vazio, numero: '1', vencimento_tipo: 'data', vencimento_data: '2026-01-01', vencimento_calculada: '2026-01-01' }, HOJE)).toBe('vencido');
    expect(motivoPendencia({ ...vazio, numero: '1', vencimento_tipo: 'indeterminado' }, HOJE)).toBeNull();
  });
  it('a pendência volta quando o documento vence e some ao renovar', () => {
    const emDia = { ...vazio, numero: '1', vencimento_tipo: 'data' as const, vencimento_data: '2026-12-31', vencimento_calculada: '2026-12-31' };
    expect(motivoPendencia(emDia, '2026-12-01')).toBeNull();
    expect(motivoPendencia(emDia, '2027-01-02')).toBe('vencido');
    expect(motivoPendencia({ ...emDia, vencimento_data: '2031-12-31', vencimento_calculada: '2031-12-31' }, '2027-01-02')).toBeNull();
  });
});

describe('pendenciasPessoais', () => {
  const pessoas = [pessoa('m', 'Mariana'), pessoa('e', 'Eduardo'), pessoa('c', 'Casal', 'casal')];
  const documentos = [
    doc('rg-m', 'm'),
    doc('cpf-m', 'm', { numero: '1', vencimento_tipo: 'indeterminado' }),
    doc('cnh-e', 'e', { numero: '2', vencimento_tipo: 'data', vencimento_data: '2026-01-01', vencimento_calculada: '2026-01-01' }),
    doc('certidao', 'c'),
    doc('de-apartamento', null, { area: 'apartamento' }),
  ];

  it('agrupa por pessoa e pelo casal, só com os pendentes', () => {
    const grupos = pendenciasPessoais(documentos, pessoas, HOJE);
    expect(grupos.map((g) => [g.nome, g.itens.map((i) => [i.id, i.motivo])])).toEqual([
      ['Mariana', [['rg-m', 'sem_preenchimento']]],
      ['Eduardo', [['cnh-e', 'vencido']]],
      ['Casal', [['certidao', 'sem_preenchimento']]],
    ]);
  });

  it('pessoa sem pendência continua no resultado, com lista vazia', () => {
    const grupos = pendenciasPessoais([doc('ok', 'm', { numero: '1', vencimento_tipo: 'indeterminado' })], [pessoa('m', 'Mariana')], HOJE);
    expect(grupos).toEqual([{ pessoaId: 'm', nome: 'Mariana', itens: [] }]);
  });
});

describe('pendenciasApartamento', () => {
  it('lista só os de apartamento com campo criado e sem conteúdo', () => {
    const itens = pendenciasApartamento([
      doc('campo-vazio', null, { area: 'apartamento', qtdCamposVazios: 2 }),
      doc('tudo-preenchido', null, { area: 'apartamento', qtdCamposVazios: 0 }),
      doc('pessoal', 'm', { qtdCamposVazios: 1 }),
    ]);
    expect(itens).toEqual([{ id: 'campo-vazio', titulo: 'campo-vazio', motivo: 'sem_preenchimento' }]);
  });
});
