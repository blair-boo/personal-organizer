import { describe, expect, it } from 'vitest';
import { contarVencidas, dataDoAviso, diasEntre, graficoDePeso, formatarKg, formatarVariacaoKg, idadeDoGato, proximasDatas, textoDeDias, variacoesDePeso } from './gatos';
import type { Gato, GatoPeso, GatoVacina, GatoVermifugo } from '../types';

const HOJE = '2026-11-22';

describe('idadeDoGato', () => {
  it('conta dias, meses, anos e meses', () => {
    expect(idadeDoGato('2026-11-22', HOJE)).toBe('0 dias');
    expect(idadeDoGato('2026-11-21', HOJE)).toBe('1 dia');
    expect(idadeDoGato('2026-11-02', HOJE)).toBe('20 dias');
    expect(idadeDoGato('2026-06-22', HOJE)).toBe('5 meses');
    expect(idadeDoGato('2026-10-22', HOJE)).toBe('1 mês');
    expect(idadeDoGato('2025-11-22', HOJE)).toBe('1 ano');
    expect(idadeDoGato('2024-08-22', HOJE)).toBe('2 anos e 3 meses');
    expect(idadeDoGato('2024-10-22', HOJE)).toBe('2 anos e 1 mês');
  });

  it('o mês só fecha no dia do aniversário', () => {
    expect(idadeDoGato('2026-10-23', HOJE)).toBe('30 dias');
    expect(idadeDoGato('2025-11-23', HOJE)).toBe('11 meses');
  });

  it('sem nascimento ou no futuro não há idade', () => {
    expect(idadeDoGato(null, HOJE)).toBeNull();
    expect(idadeDoGato('2027-01-01', HOJE)).toBeNull();
  });
});

describe('diasEntre e textoDeDias', () => {
  it('conta dias e escreve em português', () => {
    expect(diasEntre('2026-11-22', '2026-12-02')).toBe(10);
    expect(diasEntre('2026-12-02', '2026-11-22')).toBe(-10);
    expect(textoDeDias(0)).toBe('hoje');
    expect(textoDeDias(1)).toBe('amanhã');
    expect(textoDeDias(12)).toBe('em 12 dias');
    expect(textoDeDias(-3)).toBe('há 3 dias');
    expect(textoDeDias(-1)).toBe('ontem');
  });
});

const gatos: Gato[] = [{ id: 'g1', nome: 'Mingau', nascimento: null, ordem: 0, foto_url: null }, { id: 'g2', nome: 'Luna', nascimento: null, ordem: 1, foto_url: null }];
const vac = (id: string, gato_id: string, vacina: string, data: string, proxima_data: string | null): GatoVacina => ({ id, gato_id, vacina, data, proxima_data });
const verm = (id: string, gato_id: string, data: string, produto: string, proxima_data: string | null): GatoVermifugo => ({ id, gato_id, data, produto, proxima_data });

describe('proximasDatas', () => {
  it('de cada vacina vale só a aplicação mais recente', () => {
    const lista = proximasDatas(gatos, [vac('a', 'g1', 'V4', '2025-01-10', '2026-01-10'), vac('b', 'g1', 'v4 ', '2026-01-10', '2027-01-10')], [], HOJE);
    expect(lista.map((p) => [p.titulo, p.data])).toEqual([['v4 ', '2027-01-10']]);
  });

  it('vacinas diferentes têm cada uma a sua; sem próxima data não entra', () => {
    const lista = proximasDatas(gatos, [vac('a', 'g1', 'V4', '2026-05-01', '2027-05-01'), vac('b', 'g1', 'Raiva', '2026-05-01', null)], [], HOJE);
    expect(lista).toHaveLength(1);
    expect(lista[0].titulo).toBe('V4');
  });

  it('vermífugo: a mais recente de cada gato, qualquer produto', () => {
    const lista = proximasDatas(gatos, [], [verm('a', 'g1', '2026-08-01', 'Drontal', '2026-11-01'), verm('b', 'g1', '2026-11-01', 'Milbemax', '2027-02-01')], HOJE);
    expect(lista.map((p) => p.titulo)).toEqual(['Vermífugo (Milbemax)']);
  });

  it('ordena por data e marca vencida e em breve', () => {
    const lista = proximasDatas(
      gatos,
      [vac('a', 'g1', 'V4', '2025-11-01', '2026-11-01'), vac('b', 'g2', 'Raiva', '2026-06-01', '2026-12-10'), vac('c', 'g2', 'FeLV', '2026-06-01', '2027-06-01')],
      [],
      HOJE
    );
    expect(lista.map((p) => p.titulo)).toEqual(['V4', 'Raiva', 'FeLV']);
    expect([lista[0].vencida, lista[0].dias]).toEqual([true, -21]);
    expect([lista[1].emBreve, lista[1].dias]).toEqual([true, 18]);
    expect(lista[2].emBreve).toBe(false);
  });

  it('ignora registro de gato que não existe mais', () => {
    expect(proximasDatas([], [vac('a', 'g9', 'V4', '2026-05-01', '2027-05-01')], [], HOJE)).toEqual([]);
  });
});

describe('peso', () => {
  const peso = (id: string, data: string, kg: number): GatoPeso => ({ id, gato_id: 'g1', data, peso_kg: kg, criado_em: data });

  it('variação em relação à pesagem anterior, na ordem das datas', () => {
    const v = variacoesDePeso([peso('c', '2026-03-01', 4.3), peso('a', '2026-01-01', 4.0), peso('b', '2026-02-01', 4.1)]);
    expect(v.get('a')).toBeUndefined();
    expect(v.get('b')).toBe(0.1);
    expect(v.get('c')).toBe(0.2);
  });

  it('formata em kg com vírgula e sinal', () => {
    expect(formatarKg(4.1)).toBe('4,10 kg');
    expect(formatarVariacaoKg(0.2)).toBe('+0,20 kg');
    expect(formatarVariacaoKg(-0.05)).toBe('-0,05 kg');
    expect(formatarVariacaoKg(0)).toBe('0,00 kg');
  });
});

describe('calendário', () => {
  it('o aviso toca 3 dias antes', () => {
    expect(dataDoAviso('2026-12-10')).toBe('2026-12-07');
  });
});

describe('contarVencidas', () => {
  it('conta só as que já passaram da data', () => {
    const base = { gatoId: 'g', gatoNome: 'Mimi', tipo: 'vacina' as const, titulo: 'V4', emBreve: false };
    expect(contarVencidas([{ ...base, data: '2026-11-01', dias: -21, vencida: true }, { ...base, data: '2026-12-01', dias: 9, vencida: false }])).toBe(1);
    expect(contarVencidas([])).toBe(0);
  });
});

describe('graficoDePeso', () => {
  const peso = (id: string, data: string, kg: number): GatoPeso => ({ id, gato_id: 'g1', data, peso_kg: kg, criado_em: data });

  it('sem duas pesagens não há tendência', () => {
    expect(graficoDePeso([], 200, 100)).toBeNull();
    expect(graficoDePeso([peso('a', '2026-01-01', 4)], 200, 100)).toBeNull();
  });

  it('ordena por data, segue o tempo real no eixo x e põe o mais pesado no alto', () => {
    const g = graficoDePeso([peso('c', '2026-01-21', 5), peso('a', '2026-01-01', 4), peso('b', '2026-01-11', 4.5)], 224, 100, 12);
    expect(g?.pontos.map((p) => p.id)).toEqual(['a', 'b', 'c']);
    expect(g?.pontos[0].x).toBe(12);
    expect(g?.pontos[1].x).toBe(112);
    expect(g?.pontos[2].x).toBe(212);
    expect(g!.pontos[2].y).toBeLessThan(g!.pontos[0].y);
    expect(g?.minimoKg).toBe(4);
    expect(g?.maximoKg).toBe(5);
  });

  it('pesos iguais ficam numa linha reta no meio', () => {
    const g = graficoDePeso([peso('a', '2026-01-01', 4), peso('b', '2026-01-02', 4)], 100, 100);
    expect(g?.pontos[0].y).toBe(g?.pontos[1].y);
  });
});
