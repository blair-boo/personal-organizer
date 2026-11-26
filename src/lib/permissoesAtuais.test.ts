import { QueryClient } from '@tanstack/react-query';
import { describe, expect, it } from 'vitest';
import { criarMutationCachePermissoes, definirPermissoesAtuais, motivoRecusaDeGravacao } from './permissoesAtuais';
import { MENSAGEM_SEM_PERMISSAO_PARA_EDITAR } from './permissoesAbas';

const BASE = '/personal-organizer/';

describe('motivoRecusaDeGravacao', () => {
  it('recusa onde não pode editar, libera onde pode, e não trava endereço fora de aba', () => {
    definirPermissoesAtuais({ pronto: true, admin: false, permissoes: { 'documentos:pessoais': { ver: true, editar: true }, 'documentos:gatos': { ver: true, editar: false } } });
    expect(motivoRecusaDeGravacao('/personal-organizer/documentos/pessoais', BASE)).toBeNull();
    expect(motivoRecusaDeGravacao('/personal-organizer/documentos/gatos', BASE)).toBe(MENSAGEM_SEM_PERMISSAO_PARA_EDITAR);
    expect(motivoRecusaDeGravacao('/personal-organizer/', BASE)).toBeNull();
  });

  it('Usuários sempre libera (cada um edita o próprio cadastro) e admin libera tudo', () => {
    definirPermissoesAtuais({ pronto: true, admin: false, permissoes: {} });
    expect(motivoRecusaDeGravacao('/personal-organizer/settings/usuarios', BASE)).toBeNull();
    definirPermissoesAtuais({ pronto: true, admin: true, permissoes: {} });
    expect(motivoRecusaDeGravacao('/personal-organizer/financas/2026-11/conta-corrente', BASE)).toBeNull();
  });

  it('recusa enquanto as permissões não carregaram', () => {
    definirPermissoesAtuais({ pronto: false, admin: false, permissoes: {} });
    expect(motivoRecusaDeGravacao('/personal-organizer/hoje', BASE)).toMatch(/carregando/);
  });
});

describe('criarMutationCachePermissoes', () => {
  async function gravar(caminho: string, extra: { onMutate?: () => void } = {}) {
    const mutationCache = criarMutationCacheDeTeste(caminho);
    const cliente = new QueryClient({ mutationCache });
    let executou = false;
    const mutacao = mutationCache.build(cliente, {
      mutationFn: async () => {
        executou = true;
        return 'ok';
      },
      ...extra,
    });
    const resultado = await mutacao.execute(undefined).then(
      () => 'gravou',
      (erro: Error) => erro.message
    );
    return { resultado, executou };
  }

  function criarMutationCacheDeTeste(caminho: string) {
    return criarMutationCachePermissoes(() => caminho, BASE);
  }

  it('não executa a gravação numa aba sem permissão, mesmo com onMutate próprio', async () => {
    definirPermissoesAtuais({ pronto: true, admin: false, permissoes: { 'documentos:gatos': { ver: true, editar: false } } });
    expect(await gravar('/personal-organizer/documentos/gatos')).toEqual({ resultado: MENSAGEM_SEM_PERMISSAO_PARA_EDITAR, executou: false });
    expect(await gravar('/personal-organizer/documentos/gatos', { onMutate: () => undefined })).toEqual({ resultado: MENSAGEM_SEM_PERMISSAO_PARA_EDITAR, executou: false });
  });

  it('executa onde pode editar', async () => {
    definirPermissoesAtuais({ pronto: true, admin: false, permissoes: { 'documentos:pessoais': { ver: true, editar: true } } });
    expect(await gravar('/personal-organizer/documentos/pessoais')).toEqual({ resultado: 'gravou', executou: true });
  });
});
