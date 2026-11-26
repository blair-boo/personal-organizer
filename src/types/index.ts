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
export type AreaDocumento = 'pessoais' | 'apartamento' | 'arquivo' | 'outros' | 'gatos';
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
  /** Login dono da conta. Lançamentos e importações herdam o dono pela conta. */
  dono_id: string;
  /** Conta conjunta: aparece na área Conjunto, e `donos` lista todos os logins donos. */
  conjunta: boolean;
  /** Logins donos de uma conta conjunta (inclui o dono_id). Vazio nas contas individuais. */
  donos: string[];
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
  /** Despesa conjunta numa conta individual: dividida com `conjunto_com`. */
  conjunto: boolean;
  conjunto_com: string | null;
  /** Quem pagou (dono da conta). Só preenchido quando `conjunto`. */
  pagador_id: string | null;
  /** Parte de quem pagou, de 0 a 100. A diferença é de `conjunto_com`. */
  divisao_percentual: number;
}

export type NivelAcessoFinancas = 'ver' | 'editar';

/** O dono libera as próprias finanças a outro login. */
export interface FinancasAcesso {
  dono_id: string;
  convidado_id: string;
  nivel: NivelAcessoFinancas;
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

export interface TarefaManutencao {
  id: string;
  nome: string;
  frequencia_dias: number;
  ultima_execucao: string | null;
  /** Data de onde conta a próxima execução, quando difere de ultima_execucao (volta ao ciclo original após atraso). */
  proxima_a_partir_de: string | null;
  /** Tarefa adiada (ou pulada desta vez): a próxima execução é esta data, até ser feita de novo. */
  adiada_ate: string | null;
  /** Dias da semana (0 = segunda ... 6 = domingo), só para tarefas semanais. */
  dias_semana: number[];
  instrucoes: string | null;
  /** Quem faz a tarefa: ninguém ainda, uma pessoa, ou o casal (qualquer um dos dois / os dois juntos). */
  responsavel_tipo: ResponsavelTipo;
  responsavel_pessoa_id: string | null;
  responsavel_casal_id: string | null;
  ativo: boolean;
}

export type BaseProximaExecucao = 'execucao' | 'prevista';

/** Uma vez em que a tarefa foi feita. */
export interface HistoricoTarefa {
  id: string;
  tarefa_id: string;
  data_execucao: string;
  /** Quando deveria ter sido feita; se for anterior a data_execucao, foi feita com atraso. */
  data_prevista: string | null;
  base_proxima: BaseProximaExecucao;
  observacao: string | null;
  criado_em: string;
}

export type TipoAdiamento = 'adiada' | 'pulada' | 'cancelada';

/** Uma vez em que a tarefa foi adiada, pulada ou teve o adiamento cancelado. */
export interface AdiamentoTarefa {
  id: string;
  tarefa_id: string;
  tipo: TipoAdiamento;
  /** Próxima execução prevista antes da mudança. */
  data_anterior: string | null;
  /** Nova data da próxima execução; null quando o adiamento foi cancelado. */
  adiada_para: string | null;
  /** Quem adiou (a pessoa ligada ao login). */
  pessoa_id: string | null;
  observacao: string | null;
  criado_em: string;
}

export type TipoPessoaDocumentos = 'pessoa' | 'casal';

/** Cadastro de Documentos > Pessoais: uma pessoa ou um casal (junção de duas pessoas). */
export interface PessoaDocumentos {
  id: string;
  nome: string;
  ordem: number;
  tipo: TipoPessoaDocumentos;
  /** Login ligado a esta pessoa (para marcar quem está usando o app). */
  usuario_id: string | null;
}

export interface CasalMembro {
  casal_id: string;
  pessoa_id: string;
}

export type ResponsavelTipo = 'nenhum' | 'pessoa' | 'qualquer' | 'juntos';

/** Quem fez uma execução de tarefa. */
export interface HistoricoPessoa {
  historico_id: string;
  pessoa_id: string;
}

export interface Documento {
  id: string;
  area: AreaDocumento;
  pessoa_id: string | null;
  gato_id: string | null;
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

export interface CaixaStorage {
  id: string;
  /** Número da caixa; o código da etiqueta (C-014) sai dele. */
  numero: number;
  nome: string;
  ordem: number;
  /** Tag principal da caixa: os itens sem tag própria seguem esta. */
  tag_id: string | null;
}

export interface ItemStorage {
  id: string;
  storage_id: string;
  nome: string;
  quantidade: number | null;
  /** Tag (cômodo) do item, a mesma lista dos itens de Apartamento. */
  tag_id: string | null;
  ordem: number;
}

export interface ObsStorage {
  id: string;
  item_id: string;
  texto: string;
  ordem: number;
}

export interface AnexoStorage {
  id: string;
  item_id: string;
  nome: string;
  arquivo_url: string;
  nome_arquivo: string;
}

/** Anexo da caixa inteira (não de um item). */
export interface AnexoCaixaStorage {
  id: string;
  storage_id: string;
  nome: string;
  arquivo_url: string;
  nome_arquivo: string;
}

export interface Gato {
  id: string;
  nome: string;
  nascimento: string | null;
  ordem: number;
  /** Caminho da foto no bucket confidencial (gatos/{id}/foto-{timestamp}.{ext}). */
  foto_url: string | null;
}

export interface GatoVacina {
  id: string;
  gato_id: string;
  vacina: string;
  data: string;
  proxima_data: string | null;
}

export interface GatoVermifugo {
  id: string;
  gato_id: string;
  data: string;
  produto: string;
  proxima_data: string | null;
}

export interface GatoConsulta {
  id: string;
  gato_id: string;
  data: string;
  veterinario: string | null;
  observacao: string | null;
}

export interface GatoExame {
  id: string;
  gato_id: string;
  data: string;
  nome: string;
  arquivo_url: string;
  nome_arquivo: string;
}

export interface GatoPeso {
  id: string;
  gato_id: string;
  data: string;
  peso_kg: number;
  criado_em: string;
}

export interface IconeArquivo {
  id: string;
  nome: string;
  url: string;
  ordem: number;
}

/** Uma divisão da galeria de ícones: pasta do bucket ('' = arquivos soltos na raiz) e seus ícones. */
export interface PastaIcones {
  pasta: string;
  icones: IconeArquivo[];
}

/** Ícone da galeria marcado como favorito (pasta '' = raiz do bucket). */
export interface IconeFavorito {
  pasta: string;
  arquivo: string;
}

export type AlvoIcone = 'funcao' | 'categoria' | 'aba' | 'pessoa' | 'caixa';
export type TemaIcone = 'claro' | 'escuro' | 'ambos';
export type CorOrigemIcone = 'padrao' | 'app' | 'minha';

/** Qual ícone do bucket aparece em uma função, categoria ou aba, e como (tamanho, máscara, cor, tema). */
export interface UsoIcone {
  id?: string;
  alvo_tipo: AlvoIcone;
  alvo_id: string;
  icone_pasta: string;
  icone_arquivo: string;
  tamanho_delta: number;
  mascara: boolean;
  cor_origem: CorOrigemIcone;
  /** 'app': nome da variável CSS (ex.: --accent); 'minha': hex. */
  cor_valor: string | null;
  tema: TemaIcone;
}

export interface AbaConfig {
  chave: string;
  /** null = nome padrão; '' = só o ícone aparece. */
  nome: string | null;
  ordem: number;
}

export interface CorUsuario {
  id: string;
  hex: string;
  label: string;
  ordem: number;
}

export interface CalendarioFeed {
  id: string;
  nome: string;
  token: string;
  criado_em: string;
  /** Inclui as próximas vacinas e vermífugos dos gatos. */
  incluir_gatos: boolean;
  /** Inclui a próxima execução das tarefas de manutenção (menos diárias e semanais). */
  incluir_tarefas: boolean;
  /** Pessoas incluídas nesse link. Vazio = todas as pessoas. */
  pessoas: PessoaDocumentos[];
}

/** Um backup que existe hoje no R2 (db/semanal/<nome> ou db/mensal/<nome>). */
export interface BackupSnapshot {
  tipo: 'semanal' | 'mensal';
  /** AAAA-MM-DD (semanal) ou AAAA-MM (mensal). */
  nome: string;
  tamanho_bytes: number;
  linhas: number | null;
}

/** Linha única de backup_status, publicada pelo workflow de backup. */
export interface BackupStatus {
  atualizado_em: string;
  snapshots: BackupSnapshot[];
  tamanho_total_bytes: number;
  tamanho_db_bytes: number;
  tamanho_arquivos_bytes: number;
  objetos_arquivos: number;
}

export type PapelUsuario = 'admin' | 'membro';

/** Um login do app (Settings > Usuários). Nasce por trigger quando o login é criado, inclusive no convite. */
export interface Perfil {
  usuario_id: string;
  email: string;
  papel: PapelUsuario;
  /** false enquanto o convite não foi aceito. */
  confirmado: boolean;
  criado_em: string;
}
