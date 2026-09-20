export type TipoConta =
  | 'conta_corrente'
  | 'conta_poupanca'
  | 'conta_investimento'
  | 'cartao_credito'
  | 'cartao_beneficio';
export type StatusConta = 'ativo' | 'inativo' | 'cancelado' | 'expirado';
export type FormatoCartao = 'fisico' | 'virtual';
export type SubtipoVirtualCartao = 'recorrente' | 'expiravel';
export type TipoCategoria = 'despesa' | 'receita';
export type TipoLancamento = 'entrada' | 'saida';
export type StatusProjeto = 'planejado' | 'andamento' | 'concluido';
export type TipoDocumentoItem = 'nota_fiscal' | 'manual' | 'outro';
export type AreaDocumento = 'pessoais' | 'apartamento' | 'arquivo' | 'outros';
export type VencimentoTipo = 'data' | 'prazo' | 'indeterminado';
export type VencimentoUnidade = 'dias' | 'meses' | 'anos';
export type RenovarTipo = 'online' | 'presencial' | 'ambos';

export interface Conta {
  id: string;
  nome: string | null;
  tipo: TipoConta;
  instituicao: string;
  cor: string | null;
  status: StatusConta;
  conta_vinculada_id: string | null;
  emissora: string | null;
  ultimos_4_digitos: string | null;
  formato: FormatoCartao | null;
  subtipo_virtual: SubtipoVirtualCartao | null;
  valor_deposito_mensal: number | null;
  dia_deposito: number | null;
}

export interface Categoria {
  id: string;
  nome: string;
  tipo: TipoCategoria;
  parent_id: string | null;
  cor: string | null;
  icone_url: string | null;
  ordem: number;
}

export interface TagItem {
  id: string;
  nome: string;
  cor: string | null;
  icone_url: string | null;
}

export interface Lancamento {
  id: string;
  conta_id: string;
  importacao_id: string | null;
  data: string;
  descricao_original: string;
  descricao_normalizada: string;
  valor: number;
  tipo: TipoLancamento;
  categoria_id: string | null;
  parcela_atual: number | null;
  parcela_total: number | null;
  observacao: string | null;
}

export interface Item {
  id: string;
  nome: string;
  marca: string | null;
  modelo: string | null;
  data_compra: string | null;
  garantia_ate: string | null;
  valor: number | null;
  observacoes: string | null;
}

export interface ItemDocumento {
  id: string;
  item_id: string;
  tipo: TipoDocumentoItem;
  descricao: string | null;
  arquivo_url: string;
  nome_arquivo: string;
}

export interface Projeto {
  id: string;
  nome: string;
  descricao: string | null;
  status: StatusProjeto;
  data_inicio: string | null;
  data_conclusao: string | null;
}

export interface ProjetoAnexo {
  id: string;
  projeto_id: string;
  descricao: string | null;
  arquivo_url: string;
  nome_arquivo: string;
}

export interface ClassificacaoTarefa {
  id: string;
  nome: string;
  cor: string | null;
  icone_url: string | null;
}

export interface TarefaManutencao {
  id: string;
  nome: string;
  frequencia_dias: number;
  ultima_execucao: string | null;
  ativo: boolean;
}

export interface PessoaDocumentos {
  id: string;
  nome: string;
  ordem: number;
}

export interface Documento {
  id: string;
  area: AreaDocumento;
  pessoa_id: string | null;
  titulo: string;
  ordem: number;
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

export interface DocumentoCampo {
  id: string;
  documento_id: string;
  nome: string;
  conteudo: string | null;
  copiavel: boolean;
  ordem: number;
}

export interface DocumentoLocalRenovacao {
  id: string;
  documento_id: string;
  local: string | null;
  endereco: string | null;
  telefone: string | null;
  ordem: number;
}

export interface DocumentoAnexo {
  id: string;
  documento_id: string;
  nome: string;
  arquivo_url: string;
  nome_arquivo: string;
}

export interface IconeArquivo {
  id: string;
  nome: string;
  url: string;
  ordem: number;
  /** Referenciado por nome fixo em algum lugar do código — não pode ser renomeado nem excluído pela aba Ícones. */
  protegido: boolean;
}

export interface CalendarioFeed {
  id: string;
  nome: string;
  token: string;
  criado_em: string;
  /** Pessoas incluídas nesse link. Vazio = todas as pessoas. */
  pessoas: PessoaDocumentos[];
}
