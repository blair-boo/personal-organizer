import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabaseClient';
import { caminhoAnexoDocumento, enviarArquivo, removerArquivo } from '../lib/storage';
import { hojeIso, somarDias } from '../lib/datas';
import type {
  AreaDocumento,
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

function queryKeyDocumentos(area: AreaDocumento, pessoaId?: string) {
  return ['documentos', area, pessoaId ?? null];
}

export function useDocumentos(area: AreaDocumento, pessoaId?: string) {
  return useQuery({
    queryKey: queryKeyDocumentos(area, pessoaId),
    queryFn: async () => {
      let query = supabase.from('documentos').select('*').eq('area', area);
      query = pessoaId ? query.eq('pessoa_id', pessoaId) : query.is('pessoa_id', null);
      const { data, error } = await query.order('ordem').order('titulo');
      if (error) throw error;
      return data as Documento[];
    },
  });
}

export function useCriarDocumento(area: AreaDocumento, pessoaId?: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (titulo: string) => {
      const { data, error } = await supabase
        .from('documentos')
        .insert({ area, pessoa_id: pessoaId ?? null, titulo })
        .select()
        .single();
      if (error) throw error;
      return data as Documento;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeyDocumentos(area, pessoaId) }),
  });
}

export function useRenomearDocumento(area: AreaDocumento, pessoaId?: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, titulo }: { id: string; titulo: string }) => {
      const { error } = await supabase.from('documentos').update({ titulo }).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeyDocumentos(area, pessoaId) }),
  });
}

/** Persiste uma nova ordem (id -> índice) pra um conjunto de documentos. */
export function useReordenarDocumentos(area: AreaDocumento, pessoaId?: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (ordens: { id: string; ordem: number }[]) => {
      await Promise.all(
        ordens.map(({ id, ordem }) =>
          supabase
            .from('documentos')
            .update({ ordem })
            .eq('id', id)
            .then(({ error }) => {
              if (error) throw error;
            })
        )
      );
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeyDocumentos(area, pessoaId) }),
  });
}

export function useExcluirDocumento(area: AreaDocumento, pessoaId?: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('documentos').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeyDocumentos(area, pessoaId) }),
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

/** Cria uma pessoa nova e já semeia os documentos padrão (vazios) pra ela. */
export function useCriarPessoaDocumentos() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (nome: string) => {
      const { data: pessoa, error: erroPessoa } = await supabase
        .from('documentos_pessoas')
        .insert({ nome })
        .select()
        .single();
      if (erroPessoa) throw erroPessoa;
      const linhas = MODELO_PADRAO_DOCUMENTOS_PESSOAIS.map((titulo, i) => ({
        area: 'pessoais' as const,
        pessoa_id: pessoa.id,
        titulo,
        ordem: i + 1,
      }));
      const { error: erroDocumentos } = await supabase.from('documentos').insert(linhas);
      if (erroDocumentos) throw erroDocumentos;
      return pessoa as PessoaDocumentos;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['documentos_pessoas'] }),
  });
}

export function useRenomearPessoaDocumentos() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, nome }: { id: string; nome: string }) => {
      const { error } = await supabase.from('documentos_pessoas').update({ nome }).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['documentos_pessoas'] }),
  });
}

/** Exclui a pessoa; `on delete cascade` já apaga seus documentos, campos, locais e anexos. */
export function useExcluirPessoaDocumentos() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('documentos_pessoas').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['documentos_pessoas'] }),
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

export function useAtualizarDocumentoPessoal(area: AreaDocumento, pessoaId?: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, dados }: { id: string; dados: DadosDocumentoPessoal }) => {
      const { error } = await supabase.from('documentos').update(dados).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeyDocumentos(area, pessoaId) }),
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

/** Substitui todos os campos livres de um documento pelo conjunto informado. */
export function useSalvarCamposDocumento(documentoId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (campos: DadosCampoDocumento[]) => {
      const { error: erroExcluir } = await supabase.from('documentos_campos').delete().eq('documento_id', documentoId);
      if (erroExcluir) throw erroExcluir;
      if (campos.length === 0) return;
      const linhas = campos.map((campo, ordem) => ({ documento_id: documentoId, ordem, ...campo }));
      const { error } = await supabase.from('documentos_campos').insert(linhas);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['documento_campos', documentoId] }),
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

/** Substitui todos os locais de renovação de um documento pelo conjunto informado. */
export function useSalvarLocaisRenovacao(documentoId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (locais: DadosLocalRenovacao[]) => {
      const { error: erroExcluir } = await supabase
        .from('documentos_locais_renovacao')
        .delete()
        .eq('documento_id', documentoId);
      if (erroExcluir) throw erroExcluir;
      if (locais.length === 0) return;
      const linhas = locais.map((local, ordem) => ({ documento_id: documentoId, ordem, ...local }));
      const { error } = await supabase.from('documentos_locais_renovacao').insert(linhas);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['documento_locais_renovacao', documentoId] }),
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
    mutationFn: async ({ arquivo, nome }: { arquivo: File; nome: string }) => {
      const caminho = caminhoAnexoDocumento(SUBPASTA_DOCUMENTOS_PESSOAIS, documentoId, nome, arquivo);
      await enviarArquivo(BUCKET_CONFIDENCIAL, caminho, arquivo);
      const { error } = await supabase.from('documentos_anexos').insert({
        documento_id: documentoId,
        nome,
        arquivo_url: caminho,
        nome_arquivo: arquivo.name,
      });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeyAnexos(documentoId) }),
  });
}

export interface AnexoParaSalvar {
  nome: string;
  arquivo_url: string;
  nome_arquivo: string;
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
export function useCriarDocumentoCompleto(area: AreaDocumento, pessoaId?: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      titulo,
      camposFixos,
      camposLivres = [],
      locaisRenovacao = [],
      anexos = [],
    }: CriarDocumentoCompletoInput) => {
      const { error: erroDocumento } = await supabase
        .from('documentos')
        .insert({ id, area, pessoa_id: pessoaId ?? null, titulo, ...camposFixos });
      if (erroDocumento) throw erroDocumento;
      if (camposLivres.length > 0) {
        const linhas = camposLivres.map((campo, ordem) => ({ documento_id: id, ordem, ...campo }));
        const { error } = await supabase.from('documentos_campos').insert(linhas);
        if (error) throw error;
      }
      if (locaisRenovacao.length > 0) {
        const linhas = locaisRenovacao.map((local, ordem) => ({ documento_id: id, ordem, ...local }));
        const { error } = await supabase.from('documentos_locais_renovacao').insert(linhas);
        if (error) throw error;
      }
      if (anexos.length > 0) {
        const linhas = anexos.map((anexo) => ({ documento_id: id, ...anexo }));
        const { error } = await supabase.from('documentos_anexos').insert(linhas);
        if (error) throw error;
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeyDocumentos(area, pessoaId) }),
  });
}

export function useRemoverAnexoDocumento(documentoId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (anexo: DocumentoAnexo) => {
      await removerArquivo(BUCKET_CONFIDENCIAL, anexo.arquivo_url);
      const { error } = await supabase.from('documentos_anexos').delete().eq('id', anexo.id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeyAnexos(documentoId) }),
  });
}

export { BUCKET_CONFIDENCIAL };
