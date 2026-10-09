import { describe, expect, it } from 'vitest';
import {
  apagarTodosOsArquivos,
  arquivosABaixar,
  estatisticasArquivos,
  extrairArquivosDasConsultas,
  guardarArquivo,
  idsObsoletos,
  lerArquivo,
  removerArquivos,
  sincronizarArquivos,
  urlDoArquivo,
  versoesGuardadas,
  type ArquivoDesejado,
} from './arquivos';

/** CacheStorage mínimo em memória, com as mesmas chamadas que o módulo usa. */
function criarCachesFalso() {
  const bancos = new Map<string, Map<string, Response>>();
  const requisicoes = new Map<string, Request>();
  return {
    async open(nome: string) {
      if (!bancos.has(nome)) bancos.set(nome, new Map());
      const banco = bancos.get(nome)!;
      return {
        async put(req: Request, resp: Response) {
          banco.set(req.url, resp);
          requisicoes.set(req.url, req);
        },
        async match(req: Request) {
          const resp = banco.get(req.url);
          return resp ? resp.clone() : undefined;
        },
        async keys() {
          return [...banco.keys()].map((url) => requisicoes.get(url)!);
        },
        async delete(req: Request) {
          return banco.delete(req.url);
        },
      } as unknown as Cache;
    },
    async delete(nome: string) {
      return bancos.delete(nome);
    },
  } as unknown as CacheStorage;
}

const a1: ArquivoDesejado = { bucket: 'confidencial', caminho: 'documentos-pessoais/doc 1/ç-rg.pdf', versao: 'v1' };
const a2: ArquivoDesejado = { bucket: 'itens-docs', caminho: 'item/nf.pdf', versao: 'v1' };

describe('urlDoArquivo', () => {
  it('é estável e codifica espaços e acentos', () => {
    expect(urlDoArquivo('confidencial', 'a b/ç.pdf')).toBe('https://arquivos-offline.local/confidencial/a%20b/%C3%A7.pdf');
    expect(urlDoArquivo('confidencial', 'a b/ç.pdf')).toBe(urlDoArquivo('confidencial', 'a b/ç.pdf'));
  });
});

describe('extrairArquivosDasConsultas', () => {
  it('junta anexos de itens, projetos e documentos e ignora o resto', () => {
    const consultas = [
      { queryKey: ['item_documentos', 'i1'], data: [{ id: 'd1', arquivo_url: 'i1/nf.pdf' }] },
      { queryKey: ['projeto_anexos', 'p1'], data: [{ id: 'd2', arquivo_url: 'p1/planta.png' }] },
      { queryKey: ['documento_anexos', 'x'], data: [{ id: 'd3', arquivo_url: 'documentos-pessoais/x/rg.pdf' }] },
      { queryKey: ['itens'], data: [{ id: 'i1', arquivo_url: 'nao-conta.pdf' }] },
      { queryKey: ['item_documentos', 'vazio'], data: undefined },
      { queryKey: ['item_documentos', 'sem-url'], data: [{ id: 'z', arquivo_url: '' }] },
    ];
    expect(extrairArquivosDasConsultas(consultas)).toEqual([
      { bucket: 'itens-docs', caminho: 'i1/nf.pdf', versao: 'd1' },
      { bucket: 'projetos-anexos', caminho: 'p1/planta.png', versao: 'd2' },
      { bucket: 'confidencial', caminho: 'documentos-pessoais/x/rg.pdf', versao: 'd3' },
    ]);
  });

  it('não repete o mesmo arquivo', () => {
    const linha = { id: 'd1', arquivo_url: 'i1/nf.pdf' };
    const consultas = [
      { queryKey: ['item_documentos', 'i1'], data: [linha] },
      { queryKey: ['item_documentos', 'i1', 'outra'], data: [linha] },
    ];
    expect(extrairArquivosDasConsultas(consultas)).toHaveLength(1);
  });
});

describe('arquivosABaixar e idsObsoletos', () => {
  it('baixa o que falta ou mudou de versão e aponta o que sobrou', () => {
    const guardados = new Map([
      ['confidencial/documentos-pessoais/doc 1/ç-rg.pdf', 'v0'],
      ['itens-docs/item/nf.pdf', 'v1'],
      ['itens-docs/velho.pdf', 'v1'],
    ]);
    expect(arquivosABaixar([a1, a2], guardados)).toEqual([a1]);
    expect(idsObsoletos([a1, a2], guardados)).toEqual(['itens-docs/velho.pdf']);
  });
});

describe('cache de arquivos', () => {
  it('guarda, lê, lista versões e conta tamanho', async () => {
    const cs = criarCachesFalso();
    await guardarArquivo(a1, new Blob(['conteudo-pdf'], { type: 'application/pdf' }), cs);
    await guardarArquivo(a2, new Blob(['xx']), cs);

    const lido = await lerArquivo(a1.bucket, a1.caminho, cs);
    expect(lido).not.toBeNull();
    expect(await lido!.text()).toBe('conteudo-pdf');
    expect(lido!.type).toBe('application/pdf');
    expect(await lerArquivo('confidencial', 'nao/existe.pdf', cs)).toBeNull();

    expect(await versoesGuardadas(cs)).toEqual(
      new Map([
        ['confidencial/documentos-pessoais/doc 1/ç-rg.pdf', 'v1'],
        ['itens-docs/item/nf.pdf', 'v1'],
      ])
    );
    expect(await estatisticasArquivos(cs)).toEqual({ arquivos: 2, bytes: 12 + 2 });
  });

  it('remove arquivos escolhidos e apaga tudo', async () => {
    const cs = criarCachesFalso();
    await guardarArquivo(a1, new Blob(['a']), cs);
    await guardarArquivo(a2, new Blob(['b']), cs);
    await removerArquivos(['itens-docs/item/nf.pdf'], cs);
    expect([...(await versoesGuardadas(cs)).keys()]).toEqual(['confidencial/documentos-pessoais/doc 1/ç-rg.pdf']);
    await apagarTodosOsArquivos(cs);
    expect(await estatisticasArquivos(cs)).toEqual({ arquivos: 0, bytes: 0 });
  });

  it('sem Cache Storage (navegador antigo) não quebra', async () => {
    expect(await lerArquivo('b', 'c', null)).toBeNull();
    expect(await estatisticasArquivos(null)).toEqual({ arquivos: 0, bytes: 0 });
    await expect(guardarArquivo(a1, new Blob(['x']), null)).resolves.toBeUndefined();
  });
});

describe('sincronizarArquivos', () => {
  it('baixa só o que falta e segue mesmo quando um arquivo falha', async () => {
    const cs = criarCachesFalso();
    await guardarArquivo(a2, new Blob(['ja-tinha']), cs);
    const a3: ArquivoDesejado = { bucket: 'projetos-anexos', caminho: 'p/planta.png', versao: 'v1' };
    const chamados: string[] = [];
    const resultado = await sincronizarArquivos(
      [a1, a2, a3],
      async (arquivo) => {
        chamados.push(arquivo.caminho);
        if (arquivo === a1) throw new Error('rede caiu');
        return new Blob(['novo']);
      },
      cs
    );
    expect(chamados.sort()).toEqual(['documentos-pessoais/doc 1/ç-rg.pdf', 'p/planta.png']);
    expect(resultado).toEqual({ baixados: 1, falhas: ['confidencial/documentos-pessoais/doc 1/ç-rg.pdf'] });
    expect(await lerArquivo('projetos-anexos', 'p/planta.png', cs)).not.toBeNull();
  });

  it('baixa de novo quando a versão mudou', async () => {
    const cs = criarCachesFalso();
    await guardarArquivo({ ...a1, versao: 'antiga' }, new Blob(['velho']), cs);
    await sincronizarArquivos([a1], async () => new Blob(['novo-conteudo']), cs);
    expect(await (await lerArquivo(a1.bucket, a1.caminho, cs))!.text()).toBe('novo-conteudo');
    expect((await versoesGuardadas(cs)).get('confidencial/documentos-pessoais/doc 1/ç-rg.pdf')).toBe('v1');
  });
});
