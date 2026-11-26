import { describe, expect, it } from 'vitest';
import { alternarPermissao, caminhoSemBase, chaveDaRota, chavesDaTabela, linhasDePermissao, permissaoDe, podeEditarAba, podeVerAba, type Permissoes } from './permissoesAbas';

describe('tabela de abas', () => {
  it('tem as principais com as subabas, sem Usuários (sempre liberada)', () => {
    const linhas = linhasDePermissao();
    expect(linhas.map((l) => l.principal.chave)).toEqual(['principal:hoje', 'principal:financas', 'principal:apartamento', 'principal:storage', 'principal:documentos', 'principal:settings']);
    expect(linhas.find((l) => l.principal.chave === 'principal:hoje')?.subabas).toEqual([]);
    expect(chavesDaTabela()).not.toContain('settings:usuarios');
    expect(chavesDaTabela()).not.toContain('settings:casais');
    expect(linhas.find((l) => l.principal.chave === 'principal:settings')?.subabas.length).toBeGreaterThan(0);
  });
});

describe('alternarPermissao', () => {
  it('o padrão é não ver e não editar', () => {
    expect(permissaoDe({}, 'principal:hoje')).toEqual({ ver: false, editar: false });
  });

  it('clicar liga e clicar de novo volta ao estado anterior', () => {
    const ligado = alternarPermissao({}, 'principal:hoje', 'ver');
    expect(permissaoDe(ligado, 'principal:hoje')).toEqual({ ver: true, editar: false });
    expect(permissaoDe(alternarPermissao(ligado, 'principal:hoje', 'ver'), 'principal:hoje')).toEqual({ ver: false, editar: false });
  });

  it('editar liga ver junto, e desligar ver desliga editar', () => {
    const editando = alternarPermissao({}, 'principal:hoje', 'editar');
    expect(permissaoDe(editando, 'principal:hoje')).toEqual({ ver: true, editar: true });
    expect(permissaoDe(alternarPermissao(editando, 'principal:hoje', 'ver'), 'principal:hoje')).toEqual({ ver: false, editar: false });
    expect(permissaoDe(alternarPermissao(editando, 'principal:hoje', 'editar'), 'principal:hoje')).toEqual({ ver: true, editar: false });
  });

  it('na principal o valor é copiado para as subabas', () => {
    const p = alternarPermissao({}, 'principal:financas', 'ver');
    expect(permissaoDe(p, 'financas:resumo').ver).toBe(true);
    expect(permissaoDe(p, 'financas:parcelamentos').ver).toBe(true);
    expect(permissaoDe(p, 'apartamento:itens').ver).toBe(false);
  });

  it('subaba ajustada depois não mexe na principal, e as outras subabas ficam como estão', () => {
    const copiado = alternarPermissao({}, 'principal:financas', 'ver');
    const ajustado = alternarPermissao(copiado, 'financas:resumo', 'ver');
    expect(permissaoDe(ajustado, 'financas:resumo').ver).toBe(false);
    expect(permissaoDe(ajustado, 'principal:financas').ver).toBe(true);
    expect(permissaoDe(ajustado, 'financas:parcelamentos').ver).toBe(true);
  });

  it('a principal copia o valor novo, não alterna cada subaba', () => {
    const base: Permissoes = { 'financas:resumo': { ver: true, editar: false } };
    const p = alternarPermissao(base, 'principal:financas', 'ver');
    expect(permissaoDe(p, 'principal:financas').ver).toBe(true);
    expect(permissaoDe(p, 'financas:resumo').ver).toBe(true);
    expect(permissaoDe(p, 'financas:parcelamentos').ver).toBe(true);
  });

  it('desligar ver na principal desliga editar nas subabas também', () => {
    const editando = alternarPermissao({}, 'principal:financas', 'editar');
    const sem = alternarPermissao(editando, 'principal:financas', 'ver');
    expect(permissaoDe(sem, 'financas:resumo')).toEqual({ ver: false, editar: false });
  });

  it('não altera o objeto original', () => {
    const base: Permissoes = {};
    alternarPermissao(base, 'principal:hoje', 'ver');
    expect(base).toEqual({});
  });
});

describe('podeVerAba e podeEditarAba', () => {
  it('admin vê e edita tudo', () => {
    expect(podeVerAba({}, true, 'principal:financas')).toBe(true);
    expect(podeEditarAba({}, true, 'financas:resumo')).toBe(true);
  });
  it('quem não é admin não vê nem edita nada por padrão', () => {
    expect(podeVerAba({}, false, 'principal:hoje')).toBe(false);
    expect(podeEditarAba({}, false, 'principal:hoje')).toBe(false);
    expect(podeVerAba({}, false, 'principal:settings')).toBe(true);
  });
  it('Casais todos veem, mas só admin edita', () => {
    expect(podeVerAba({}, false, 'settings:casais')).toBe(true);
    expect(podeEditarAba({}, false, 'settings:casais')).toBe(false);
    expect(podeEditarAba({ 'settings:casais': { ver: true, editar: true } }, false, 'settings:casais')).toBe(false);
    expect(podeEditarAba({}, true, 'settings:casais')).toBe(true);
  });
  it('Usuários é sempre liberada, para cada um editar o próprio cadastro', () => {
    expect(podeVerAba({}, false, 'settings:usuarios')).toBe(true);
    expect(podeEditarAba({}, false, 'settings:usuarios')).toBe(true);
  });
  it('a principal aparece se alguma subaba tem ver, mesmo sem ver nela', () => {
    const p: Permissoes = { 'financas:resumo': { ver: true, editar: false } };
    expect(podeVerAba(p, false, 'principal:financas')).toBe(true);
    expect(podeVerAba(p, false, 'financas:resumo')).toBe(true);
    expect(podeVerAba(p, false, 'financas:parcelamentos')).toBe(false);
    expect(podeVerAba(p, false, 'principal:apartamento')).toBe(false);
  });
  it('editar vale por aba', () => {
    const p: Permissoes = { 'documentos:pessoais': { ver: true, editar: true }, 'documentos:gatos': { ver: true, editar: false } };
    expect(podeEditarAba(p, false, 'documentos:pessoais')).toBe(true);
    expect(podeEditarAba(p, false, 'documentos:gatos')).toBe(false);
  });
});

describe('chaveDaRota', () => {
  it('abas sem subaba', () => {
    expect(chaveDaRota('/hoje')).toBe('principal:hoje');
    expect(chaveDaRota('/storage')).toBe('principal:storage');
  });
  it('subabas de Documentos, Apartamento e Settings', () => {
    expect(chaveDaRota('/documentos/pessoais')).toBe('documentos:pessoais');
    expect(chaveDaRota('/apartamento/tarefas')).toBe('apartamento:tarefas');
    expect(chaveDaRota('/apartamento/manutencao')).toBe('apartamento:tarefas');
    expect(chaveDaRota('/settings/usuarios')).toBe('settings:usuarios');
    expect(chaveDaRota('/settings/casais')).toBe('settings:casais');
  });
  it('Finanças: competência na frente e rotas soltas', () => {
    expect(chaveDaRota('/financas/2026-11/conta-corrente')).toBe('financas:conta-corrente');
    expect(chaveDaRota('/financas/2026-11/resumo')).toBe('financas:resumo');
    expect(chaveDaRota('/financas/resumo-geral')).toBe('financas:resumo-geral');
    expect(chaveDaRota('/financas/parcelamentos')).toBe('financas:parcelamentos');
  });
  it('endereços que só redirecionam ou desconhecidos não são de nenhuma aba', () => {
    expect(chaveDaRota('/')).toBeNull();
    expect(chaveDaRota('/documentos')).toBeNull();
    expect(chaveDaRota('/financas/2026-11')).toBeNull();
    expect(chaveDaRota('/documentos/xyz')).toBeNull();
  });
});

describe('caminhoSemBase', () => {
  it('tira o prefixo do app', () => {
    expect(caminhoSemBase('/personal-organizer/hoje', '/personal-organizer/')).toBe('/hoje');
    expect(caminhoSemBase('/personal-organizer', '/personal-organizer/')).toBe('/');
    expect(caminhoSemBase('/hoje', '/')).toBe('/hoje');
  });
});
