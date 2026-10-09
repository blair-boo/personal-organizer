import { afterEach, describe, expect, it, vi } from 'vitest';
import { MENSAGEM_SEM_CONEXAO, mensagemDeErro } from './erros';

afterEach(() => vi.unstubAllGlobals());

describe('mensagemDeErro', () => {
  it('extrai a mensagem de Error, string e objetos do Supabase', () => {
    expect(mensagemDeErro(new Error('deu ruim'))).toBe('deu ruim');
    expect(mensagemDeErro('texto')).toBe('texto');
    expect(mensagemDeErro({ message: 'violação de chave', code: '23503' })).toBe('violação de chave');
    expect(mensagemDeErro({ details: 'detalhe' })).toBe('detalhe');
    expect(mensagemDeErro(42)).toBe('42');
  });

  it('falha de rede sem internet vira aviso de sem conexão', () => {
    vi.stubGlobal('navigator', { onLine: false });
    expect(mensagemDeErro({ message: 'TypeError: Failed to fetch' })).toBe(MENSAGEM_SEM_CONEXAO);
    expect(mensagemDeErro(new TypeError('Load failed'))).toBe(MENSAGEM_SEM_CONEXAO);
  });

  it('falha de rede com internet vira aviso de servidor inacessível', () => {
    vi.stubGlobal('navigator', { onLine: true });
    expect(mensagemDeErro({ message: 'TypeError: Failed to fetch' })).toContain('falar com o servidor');
  });

  it('estouro do limite de tempo vira aviso de demora', () => {
    vi.stubGlobal('navigator', { onLine: true });
    expect(mensagemDeErro({ message: 'TimeoutError: The operation was aborted due to timeout' })).toContain('demorou demais');
  });

  it('não mexe em erros de verdade do banco', () => {
    vi.stubGlobal('navigator', { onLine: false });
    expect(mensagemDeErro({ message: 'duplicate key value violates unique constraint' })).toBe('duplicate key value violates unique constraint');
  });
});
