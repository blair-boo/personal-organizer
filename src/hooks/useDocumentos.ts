import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabaseClient';
import { executarOuEnfileirar } from '../lib/offline/executarOuEnfileirar';
import { caminhoAnexoDocumento } from '../lib/storage';
import { aposGravar, SEM_BLOQUEIO_OFFLINE } from './mutacoesOffline';
import { hojeIso, somarDias } from '../lib/datas';
import type {
  AreaDocumento,
  CasalMembro,
  Documento,
  DocumentoAnexo,
  DocumentoCampo,
  DocumentoLocalRenovacao,
  PessoaDocumentos,
  RenovarTipo,
  VencimentoTipo,
  VencimentoUnidade,
} from '../types';

const BUCKET_CONFIDENCIAL = 'confidencial';
const SUBPASTA_DOCUMENTOS_PESSOAIS = 'documentos-pessoais';

/** Lista fixa dos documentos padrão copiados pra toda pessoa nova em Documentos > Pessoais. Gravada aqui de propósito: não segue o que Rat_1 tiver depois. */
export const MODELO_PADRAO_DOCUMENTOS_PESSOAIS = [
  'Certidão de Nascimento',
  'Carteira de Identidade Nacional (CIN)',
  'CPF (Cadastro de Pessoas Físicas)',
  'Título de Eleitor',
  'CNH (Carteira Nacional de Habilitação)',
  'Carteira de Trabalho (CTPS)',
  'Passaporte',
];

function queryKeyDocumentos(area: AreaDocumento, pessoaId?: string, gatoId?: string) {
  return ['documentos', area, pessoaId ?? null, gatoId ?? null];
}

export function useDocumentos(area: AreaDocumento, pessoaId?: string, gatoId?: string) {
  return useQuery({
    queryKey: queryKeyDocumentos(area, pessoaId, gatoId),
    queryFn: async () => {
      let query = supabase.from('documentos').select('*').eq('area', area);
      if (gatoId) query = query.eq('gato_id', gatoId);
      else query = pessoaId ? query.eq('pessoa_id', pessoaId) : query.is('pessoa_id', null);
      const { data, error } = await query.order('ordem').order('titulo');
      if (error) throw error;
      return data as Documento[];
    },
  });
}

const ORDEM_DOCUMENTOS = { campo: 'ordem' };

export function useCriarDocumento(area: AreaDocumento, pessoaId?: string, gatoId?: string) {
  const qc = useQueryClient();
  const chave = queryKeyDocumentos(area, pessoaId, gatoId);
  return useMutation({
    onMutate: SEM_BLOQUEIO_OFFLINE,
    mutationFn: async (titulo: string) => {
      const ordemNova = ((qc.getQueryData<Documento[]>(chave) ?? []).reduce((maior, d) => Math.max(maior, d.ordem ?? 0), -1)) + 1;
      const documento = { id: crypto.randomUUID(), area, pessoa_id: pessoaId ?? null, gato_id: gatoId ?? null, titulo, ordem: ordemNova } as Documento;
      const resultado = await executarOuEnfileirar(qc, 'tabela.inserir', { tabela: 'documentos', consulta: chave, linha: documento, ordenarPor: ORDEM_DOCUMENTOS });
      return { documento, resultado };
    },
    onSuccess: ({ resultado }) => aposGravar(qc, [chave])(resultado),
  });
}

export function useRenomearDocumento(area: AreaDocumento, pessoaId?: string, gatoId?: string) {
  const qc = useQueryClient();
  const chave = queryKeyDocumentos(area, pessoaId, gatoId);
  return useMutation({
    onMutate: SEM_BLOQUEIO_OFFLINE,
    mutationFn: ({ id, titulo }: { id: string; titulo: string }) => executarOuEnfileirar(qc, 'tabela.atualizar', { tabela: 'documentos', consultas: [chave], id, mudancas: { titulo } }),
    onSuccess: aposGravar(qc, [chave]),
  });
}

/** Persiste uma nova ordem (id -> índice) pra um conjunto de documentos. */
export function useReordenarDocumentos(area: AreaDocumento, pessoaId?: string, gatoId?: string) {
  const qc = useQueryClient();
  const chave = queryKeyDocumentos(area, pessoaId, gatoId);
  return useMutation({
    onMutate: SEM_BLOQUEIO_OFFLINE,
    mutationFn: async (ordens: { id: string; ordem: number }[]) => {
      let resultado: 'enviada' | 'enfileirada' = 'enviada';
      for (const { id, ordem } of ordens) {
        resultado = await executarOuEnfileirar(qc, 'tabela.atualizar', { tabela: 'documentos', consultas: [chave], id, mudancas: { ordem }, ordenarPor: ORDEM_DOCUMENTOS });
      }
      return resultado;
    },
    onSuccess: aposGravar(qc, [chave]),
  });
}

export function useExcluirDocumento(area: AreaDocumento, pessoaId?: string, gatoId?: string) {
  const qc = useQueryClient();
  const chave = queryKeyDocumentos(area, pessoaId, gatoId);
  return useMutation({
    onMutate: SEM_BLOQUEIO_OFFLINE,
    mutationFn: (id: string) => executarOuEnfileirar(qc, 'tabela.excluir', { tabela: 'documentos', consultas: [chave], ids: [id] }),
    onSuccess: aposGravar(qc, [chave]),
  });
}

/** Pessoas de Documentos > Pessoais (Rat_1, Casal, e as que forem criadas pelo botão + Pessoa). */
export function useDocumentosPessoas() {
  return useQuery({
    queryKey: ['documentos_pessoas'],
    queryFn: async () => {
      const { data, error } = await supabase.from('documentos_pessoas').select('*').order('ordem').order('nome');
      if (error) throw error;
      return data as PessoaDocumentos[];
    },
  });
}

/** Cria uma pessoa nova e já semeia os documentos padrão (vazios) pra ela. Funciona sem internet. */
export function useCriarPessoaDocumentos() {
  const qc = useQueryClient();
  return useMutation({
    onMutate: SEM_BLOQUEIO_OFFLINE,
    mutationFn: async (nome: string) => {
      const pessoa: PessoaDocumentos = { id: crypto.randomUUID(), nome, ordem: 0, tipo: 'pessoa', usuario_id: null };
      await executarOuEnfileirar(qc, 'tabela.inserir', { tabela: 'documentos_pessoas', consulta: ['documentos_pessoas'], linha: pessoa });
      const chaveDocumentos = queryKeyDocumentos('pessoais', pessoa.id);
      qc.setQueryData(chaveDocumentos, []);
      let resultado: 'enviada' | 'enfileirada' = 'enviada';
      for (const [i, titulo] of MODELO_PADRAO_DOCUMENTOS_PESSOAIS.entries()) {
        resultado = await executarOuEnfileirar(qc, 'tabela.inserir', {
          tabela: 'documentos',
          consulta: chaveDocumentos,
          linha: { id: crypto.randomUUID(), area: 'pessoais', pessoa_id: pessoa.id, titulo, ordem: i + 1 },
          ordenarPor: ORDEM_DOCUMENTOS,
        });
      }
      return { pessoa, resultado };
    },
    onSuccess: ({ resultado }) => aposGravar(qc, [['documentos_pessoas'], ['documentos']])(resultado),
  });
}

export function useRenomearPessoaDocumentos() {
  const qc = useQueryClient();
  return useMutation({
    onMutate: SEM_BLOQUEIO_OFFLINE,
    mutationFn: ({ id, nome }: { id: string; nome: string }) =>
      executarOuEnfileirar(qc, 'tabela.atualizar', { tabela: 'documentos_pessoas', consultas: [['documentos_pessoas']], id, mudancas: { nome } }),
    onSuccess: aposGravar(qc, [['documentos_pessoas']]),
  });
}

/** Exclui a pessoa; `on delete cascade` já apaga seus documentos, campos, locais e anexos. */
export function useExcluirPessoaDocumentos() {
  const qc = useQueryClient();
  return useMutation({
    onMutate: SEM_BLOQUEIO_OFFLINE,
    mutationFn: (id: string) => executarOuEnfileirar(qc, 'tabela.excluir', { tabela: 'documentos_pessoas', consultas: [['documentos_pessoas']], ids: [id] }),
    onSuccess: aposGravar(qc, [['documentos_pessoas'], ['documentos_casal_membros'], ['documentos']]),
  });
}

/** Quem faz parte de cada casal (um casal junta duas pessoas). */
export function useCasalMembros() {
  return useQuery({
    queryKey: ['documentos_casal_membros'],
    queryFn: async () => {
      const { data, error } = await supabase.from('documentos_casal_membros').select('*');
      if (error) throw error;
      return data as CasalMembro[];
    },
  });
}

/** Documentos padrão de um casal novo (os mesmos do cadastro original do Casal). */
export const MODELO_PADRAO_DOCUMENTOS_CASAL = [
  'Certidão de Casamento',
  'Escritura Pública de Pacto Antenupcial',
  'Certidão de Registro do Pacto Antenupcial',
];

export interface NovoCasalDocumentos {
  nome: string;
  /** Pessoas que já existem. */
  pessoaIds: string[];
  /** Nomes de pessoas a criar na hora (com os documentos padrão delas) e juntar ao casal. */
  novasPessoas: string[];
}

/** Cria o casal juntando duas pessoas (existentes e/ou criadas agora) e já semeia os documentos padrão do casal. Funciona sem internet. */
export function useCriarCasalDocumentos() {
  const qc = useQueryClient();
  return useMutation({
    onMutate: SEM_BLOQUEIO_OFFLINE,
    mutationFn: async ({ nome, pessoaIds, novasPessoas }: NovoCasalDocumentos) => {
      const novas = novasPessoas.map((nomeNovo) => ({ id: crypto.randomUUID(), nome: nomeNovo }));
      const ids = [...pessoaIds, ...novas.map((p) => p.id)];
      if (ids.length !== 2 || ids[0] === ids[1]) throw new Error('Um casal junta exatamente duas pessoas diferentes.');
      const casal: PessoaDocumentos = { id: crypto.randomUUID(), nome, tipo: 'casal', ordem: 0, usuario_id: null };
      const documentos = (donoId: string, modelo: string[]) => modelo.map((titulo, i) => ({ id: crypto.randomUUID(), area: 'pessoais', pessoa_id: donoId, titulo, ordem: i + 1 }));
      const resultado = await executarOuEnfileirar(qc, 'casal.criar', {
        pessoas: novas.map((p) => ({ ...p, tipo: 'pessoa', ordem: 0, usuario_id: null })),
        documentosPessoas: novas.flatMap((p) => documentos(p.id, MODELO_PADRAO_DOCUMENTOS_PESSOAIS)),
        casal: { ...casal },
        membros: ids.map((pessoa_id) => ({ casal_id: casal.id, pessoa_id })),
        documentosCasal: documentos(casal.id, MODELO_PADRAO_DOCUMENTOS_CASAL),
      });
      return { casal, resultado };
    },
    onSuccess: ({ resultado }) => aposGravar(qc, [['documentos_pessoas'], ['documentos_casal_membros'], ['documentos']])(resultado),
  });
}

export interface ProximoVencimento {
  documentoId: string;
  pessoaId: string;
  pessoaNome: string;
  titulo: string;
  vencimentoCalculada: string;
  diasRestantes: number;
}

/** Documentos pessoais com aviso de vencimento ativado, dentro do prazo de aviso (inclui já vencidos), de todas as pessoas. */
export function useProximosVencimentosPessoais() {
  return useQuery({
    queryKey: ['documentos_proximos_vencimentos'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('documentos')
        .select('id, titulo, pessoa_id, vencimento_calculada, aviso_dias, pessoa:documentos_pessoas(nome)')
        .eq('area', 'pessoais')
        .eq('aviso_vencimento', true)
        .not('vencimento_calculada', 'is', null);
      if (error) throw error;
      const hoje = hojeIso();
      const itens: ProximoVencimento[] = [];
      for (const linha of data as unknown as {
        id: string;
        titulo: string;
        pessoa_id: string | null;
        vencimento_calculada: string;
        aviso_dias: number | null;
        pessoa: { nome: string } | null;
      }[]) {
        if (!linha.pessoa_id || !linha.pessoa) continue;
        const limite = somarDias(hoje, linha.aviso_dias ?? 0);
        if (linha.vencimento_calculada > limite) continue;
        const diasRestantes = Math.round(
          (new Date(linha.vencimento_calculada).getTime() - new Date(hoje).getTime()) / 86400000
        );
        itens.push({
          documentoId: linha.id,
          pessoaId: linha.pessoa_id,
          pessoaNome: linha.pessoa.nome,
          titulo: linha.titulo,
          vencimentoCalculada: linha.vencimento_calculada,
          diasRestantes,
        });
      }
      itens.sort((a, b) => a.vencimentoCalculada.localeCompare(b.vencimentoCalculada));
      return itens;
    },
  });
}

/** Campos fixos do formulário de documento pessoal (área "pessoais"). */
export interface DadosDocumentoPessoal {
  titulo: string;
  numero: string | null;
  numero_espelho: string | null;
  emissao: string | null;
  vencimento_tipo: VencimentoTipo | null;
  vencimento_data: string | null;
  vencimento_quantidade: number | null;
  vencimento_unidade: VencimentoUnidade | null;
  vencimento_calculada: string | null;
  aviso_vencimento: boolean;
  aviso_dias: number | null;
  renovar_tipo: RenovarTipo | null;
  renovar_site_nome: string | null;
  renovar_site_link: string | null;
}

export function useAtualizarDocumentoPessoal(area: AreaDocumento, pessoaId?: string, gatoId?: string) {
  const qc = useQueryClient();
  const chave = queryKeyDocumentos(area, pessoaId, gatoId);
  return useMutation({
    onMutate: SEM_BLOQUEIO_OFFLINE,
    mutationFn: ({ id, dados }: { id: string; dados: DadosDocumentoPessoal }) =>
      executarOuEnfileirar(qc, 'tabela.atualizar', { tabela: 'documentos', consultas: [chave], id, mudancas: { ...dados }, ordenarPor: ORDEM_DOCUMENTOS }),
    onSuccess: aposGravar(qc, [chave, ['documentos_proximos_vencimentos']]),
  });
}

/** Campos livres (Padrão A genérico: Apartamento/Arquivo/Outros). */

export function useDocumentoCampos(documentoId: string) {
  return useQuery({
    queryKey: ['documento_campos', documentoId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('documentos_campos')
        .select('*')
        .eq('documento_id', documentoId)
        .order('ordem');
      if (error) throw error;
      return data as DocumentoCampo[];
    },
    enabled: !!documentoId,
  });
}

export interface DadosCampoDocumento {
  nome: string;
  conteudo: string | null;
  copiavel: boolean;
}

/** Substitui todos os campos livres de um documento pelo conjunto informado. Funciona sem internet. */
export function useSalvarCamposDocumento(documentoId: string) {
  const qc = useQueryClient();
  const chave = ['documento_campos', documentoId];
  return useMutation({
    onMutate: SEM_BLOQUEIO_OFFLINE,
    mutationFn: (campos: DadosCampoDocumento[]) =>
      executarOuEnfileirar(qc, 'tabela.substituirConjunto', {
        tabela: 'documentos_campos',
        coluna: 'documento_id',
        vinculoId: documentoId,
        consulta: chave,
        linhas: campos.map((campo, ordem) => ({ id: crypto.randomUUID(), documento_id: documentoId, ordem, ...campo })),
      }),
    onSuccess: aposGravar(qc, [chave]),
  });
}

/** Locais de renovação presencial (Documentos Pessoais, quando Renovar = Presencial/Ambos). */
export function useDocumentoLocaisRenovacao(documentoId: string) {
  return useQuery({
    queryKey: ['documento_locais_renovacao', documentoId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('documentos_locais_renovacao')
        .select('*')
        .eq('documento_id', documentoId)
        .order('ordem');
      if (error) throw error;
      return data as DocumentoLocalRenovacao[];
    },
    enabled: !!documentoId,
  });
}

export interface DadosLocalRenovacao {
  local: string | null;
  endereco: string | null;
  telefone: string | null;
}

/** Substitui todos os locais de renovação de um documento pelo conjunto informado. Funciona sem internet. */
export function useSalvarLocaisRenovacao(documentoId: string) {
  const qc = useQueryClient();
  const chave = ['documento_locais_renovacao', documentoId];
  return useMutation({
    onMutate: SEM_BLOQUEIO_OFFLINE,
    mutationFn: (locais: DadosLocalRenovacao[]) =>
      executarOuEnfileirar(qc, 'tabela.substituirConjunto', {
        tabela: 'documentos_locais_renovacao',
        coluna: 'documento_id',
        vinculoId: documentoId,
        consulta: chave,
        linhas: locais.map((local, ordem) => ({ id: crypto.randomUUID(), documento_id: documentoId, ordem, ...local })),
      }),
    onSuccess: aposGravar(qc, [chave]),
  });
}

function queryKeyAnexos(documentoId: string) {
  return ['documento_anexos', documentoId];
}

/** Anexos de documentos (bucket confidencial). URLs assinadas de curta duração — ver CLAUDE.md/plano de confidencialidade. */
export function useDocumentoAnexos(documentoId: string) {
  return useQuery({
    queryKey: queryKeyAnexos(documentoId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('documentos_anexos')
        .select('*')
        .eq('documento_id', documentoId)
        .order('criado_em');
      if (error) throw error;
      return data as DocumentoAnexo[];
    },
    enabled: !!documentoId,
  });
}

export function useAdicionarAnexoDocumento(documentoId: string) {
  const qc = useQueryClient();
  return useMutation({
    onMutate: SEM_BLOQUEIO_OFFLINE,
    mutationFn: ({ arquivo, nome }: { arquivo: File; nome: string }) =>
      executarOuEnfileirar(qc, 'anexo.incluir', {
        tabela: 'documentos_anexos',
        consulta: queryKeyAnexos(documentoId),
        linha: { id: crypto.randomUUID(), documento_id: documentoId, nome, arquivo_url: caminhoAnexoDocumento(SUBPASTA_DOCUMENTOS_PESSOAIS, documentoId, nome, arquivo), nome_arquivo: arquivo.name },
        bucket: BUCKET_CONFIDENCIAL,
        arquivoLocal: arquivo,
        nomeArquivo: arquivo.name,
      }),
    onSuccess: aposGravar(qc, [queryKeyAnexos(documentoId)]),
  });
}

export interface AnexoParaSalvar {
  nome: string;
  arquivo_url: string;
  nome_arquivo: string;
  /** Arquivo tirado sem internet: ainda não está no bucket e sobe junto com a fila. */
  arquivoLocal?: Blob;
}

export interface CriarDocumentoCompletoInput {
  id: string;
  titulo: string;
  camposFixos?: Partial<Omit<DadosDocumentoPessoal, 'titulo'>>;
  camposLivres?: DadosCampoDocumento[];
  locaisRenovacao?: DadosLocalRenovacao[];
  anexos?: AnexoParaSalvar[];
}

/**
 * Cria o documento inteiro de uma vez: linha em `documentos` (com o id já
 * gerado no navegador, pra bater com os arquivos já enviados ao Storage
 * durante a criação), campos livres, locais de renovação e anexos.
 */
export function useCriarDocumentoCompleto(area: AreaDocumento, pessoaId?: string, gatoId?: string) {
  const qc = useQueryClient();
  const chave = queryKeyDocumentos(area, pessoaId, gatoId);
  return useMutation({
    onMutate: SEM_BLOQUEIO_OFFLINE,
    mutationFn: ({ id, titulo, camposFixos, camposLivres = [], locaisRenovacao = [], anexos = [] }: CriarDocumentoCompletoInput) => {
      const ordemNova = (qc.getQueryData<Documento[]>(chave) ?? []).reduce((maior, d) => Math.max(maior, d.ordem ?? 0), -1) + 1;
      return executarOuEnfileirar(qc, 'documento.criarCompleto', {
        consulta: chave,
        documento: { id, area, pessoa_id: pessoaId ?? null, gato_id: gatoId ?? null, titulo, ordem: ordemNova, ...camposFixos },
        campos: camposLivres.map((campo, ordem) => ({ id: crypto.randomUUID(), documento_id: id, ordem, ...campo })),
        locais: locaisRenovacao.map((local, ordem) => ({ id: crypto.randomUUID(), documento_id: id, ordem, ...local })),
        anexos: anexos.map(({ arquivoLocal, ...anexo }) => ({ linha: { id: crypto.randomUUID(), documento_id: id, ...anexo }, arquivoLocal, nomeArquivo: anexo.nome_arquivo })),
        bucket: BUCKET_CONFIDENCIAL,
      });
    },
    onSuccess: aposGravar(qc, [chave, ['documento_campos'], ['documento_locais_renovacao'], ['documento_anexos']]),
  });
}

export function useRemoverAnexoDocumento(documentoId: string) {
  const qc = useQueryClient();
  return useMutation({
    onMutate: SEM_BLOQUEIO_OFFLINE,
    mutationFn: (anexo: DocumentoAnexo) =>
      executarOuEnfileirar(qc, 'anexo.excluir', { tabela: 'documentos_anexos', consulta: queryKeyAnexos(documentoId), id: anexo.id, bucket: BUCKET_CONFIDENCIAL, caminho: anexo.arquivo_url }),
    onSuccess: aposGravar(qc, [queryKeyAnexos(documentoId)]),
  });
}

export { BUCKET_CONFIDENCIAL };
