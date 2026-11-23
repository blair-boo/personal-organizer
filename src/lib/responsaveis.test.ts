import { describe, expect, it } from 'vitest';
import {
  chaveDoResponsavel,
  colunaDoResponsavel,
  membrosPorCasal,
  opcoesDeResponsavel,
  pessoasPadraoDaExecucao,
  responsavelDaColuna,
  semResponsavel,
  SEM_RESPONSAVEL,
  tarefaDaPessoa,
  textoDoResponsavel,
} from './responsaveis';
import type { PessoaDocumentos } from '../types';

const pessoa = (id: string, nome: string, tipo: 'pessoa' | 'casal' = 'pessoa'): PessoaDocumentos => ({ id, nome, ordem: 0, tipo, usuario_id: null });
const pessoas = [pessoa('e', 'Eduardo'), pessoa('m', 'Mariana'), pessoa('c', 'Casal', 'casal')];
const membros = membrosPorCasal([{ casal_id: 'c', pessoa_id: 'e' }, { casal_id: 'c', pessoa_id: 'm' }]);
const nomes = new Map([['e', 'Eduardo'], ['m', 'Mariana']]);

const pessoaM = { responsavel_tipo: 'pessoa' as const, responsavel_pessoa_id: 'm', responsavel_casal_id: null };
const qualquer = { responsavel_tipo: 'qualquer' as const, responsavel_pessoa_id: null, responsavel_casal_id: 'c' };
const juntos = { responsavel_tipo: 'juntos' as const, responsavel_pessoa_id: null, responsavel_casal_id: 'c' };

describe('opcoesDeResponsavel', () => {
  it('nenhuma, cada pessoa e Qualquer um e Juntos do casal; o casal não vira pessoa', () => {
    expect(opcoesDeResponsavel(pessoas).map((o) => o.rotulo)).toEqual(['Nenhuma (atribuir depois)', 'Eduardo', 'Mariana', 'Qualquer um', 'Juntos']);
  });

  it('com mais de um casal, o nome do casal acompanha Qualquer um e Juntos', () => {
    const duas = [...pessoas, pessoa('c2', 'Pais', 'casal')];
    expect(opcoesDeResponsavel(duas).map((o) => o.rotulo)).toContain('Qualquer um (Pais)');
    expect(opcoesDeResponsavel(duas).map((o) => o.rotulo)).toContain('Juntos (Casal)');
  });

  it('a chave da escolha volta ao responsável da tarefa', () => {
    const op = opcoesDeResponsavel(pessoas);
    for (const o of op) expect(chaveDoResponsavel(o)).toBe(o.chave);
  });
});

describe('textoDoResponsavel', () => {
  it('escreve a pessoa, o qualquer um e o juntos', () => {
    expect(textoDoResponsavel(pessoaM, membros, nomes)).toBe('Mariana');
    expect(textoDoResponsavel(qualquer, membros, nomes)).toBe('Qualquer um (Eduardo ou Mariana)');
    expect(textoDoResponsavel(juntos, membros, nomes)).toBe('Juntos (Eduardo e Mariana)');
    expect(textoDoResponsavel(SEM_RESPONSAVEL, membros, nomes)).toBe('');
  });
});

describe('pessoasPadraoDaExecucao', () => {
  it('juntos: os dois', () => {
    expect(pessoasPadraoDaExecucao(juntos, membros, 'm')).toEqual(['e', 'm']);
  });

  it('qualquer um: quem está usando o app, se for do casal; senão os dois', () => {
    expect(pessoasPadraoDaExecucao(qualquer, membros, 'm')).toEqual(['m']);
    expect(pessoasPadraoDaExecucao(qualquer, membros, 'outra')).toEqual(['e', 'm']);
    expect(pessoasPadraoDaExecucao(qualquer, membros, null)).toEqual(['e', 'm']);
  });

  it('uma pessoa: ela; sem responsável: quem está usando o app', () => {
    expect(pessoasPadraoDaExecucao({ ...pessoaM, responsavel_pessoa_id: 'e' }, membros, 'm')).toEqual(['e']);
    expect(pessoasPadraoDaExecucao(SEM_RESPONSAVEL, membros, 'm')).toEqual(['m']);
    expect(pessoasPadraoDaExecucao(SEM_RESPONSAVEL, membros, null)).toEqual([]);
  });
});

describe('tarefaDaPessoa e semResponsavel', () => {
  it('a tarefa do casal é de cada um dos dois', () => {
    expect(tarefaDaPessoa(qualquer, 'e', membros)).toBe(true);
    expect(tarefaDaPessoa(juntos, 'm', membros)).toBe(true);
    expect(tarefaDaPessoa(pessoaM, 'e', membros)).toBe(false);
    expect(tarefaDaPessoa(pessoaM, 'm', membros)).toBe(true);
  });

  it('casal excluído deixa a tarefa sem responsável', () => {
    expect(semResponsavel(SEM_RESPONSAVEL, membros)).toBe(true);
    expect(semResponsavel({ ...qualquer, responsavel_casal_id: null }, membros)).toBe(true);
    expect(semResponsavel(pessoaM, membros)).toBe(false);
  });
});

describe('kanban por pessoa', () => {
  it('coloca a tarefa na coluna certa', () => {
    expect(colunaDoResponsavel(pessoaM, membros)).toBe('pessoa:m');
    expect(colunaDoResponsavel(qualquer, membros)).toBe('qualquer');
    expect(colunaDoResponsavel(juntos, membros)).toBe('juntos');
    expect(colunaDoResponsavel(SEM_RESPONSAVEL, membros)).toBe('sem');
  });

  it('soltar numa coluna gera o responsável; qualquer um e juntos precisam de um casal', () => {
    expect(responsavelDaColuna('pessoa:e', 'c')).toEqual({ responsavel_tipo: 'pessoa', responsavel_pessoa_id: 'e', responsavel_casal_id: null });
    expect(responsavelDaColuna('juntos', 'c')).toEqual(juntos);
    expect(responsavelDaColuna('juntos', null)).toBeNull();
    expect(responsavelDaColuna('sem', null)).toEqual(SEM_RESPONSAVEL);
  });
});
