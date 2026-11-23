import type { AnexoStorage, BaseProximaExecucao } from '../../types';

/** Dados de cada tipo de alteração que pode esperar internet na fila. Só tipos: nada daqui fala com o servidor. */

export interface AnexoNovoDados {
  /** Id da linha de anexo, gerado no aparelho (assim a cópia local do arquivo e a linha batem). */
  id: string;
  nome: string;
  arquivo_url: string;
  nome_arquivo: string;
  /** Foto tirada sem internet: ainda não está no bucket, sobe junto com a fila. */
  arquivoLocal?: Blob;
}

export interface ItemParaSalvar {
  id: string;
  nome: string;
  quantidade: number | null;
  tag_id: string | null;
  obs: string[];
  anexosNovos: AnexoNovoDados[];
  anexosRemovidos: AnexoStorage[];
}

export interface SalvarCaixaDados {
  id: string;
  /** Número da caixa nova (o código da etiqueta). */
  numero?: number;
  nome: string;
  novo: boolean;
  /** Posição da caixa nova (a última + 1). Ignorada ao editar. */
  ordemNova: number;
  /** Itens que ficam na caixa, na ordem em que aparecem. */
  itens: ItemParaSalvar[];
  /** Itens existentes que saíram da caixa (são excluídos, com seus arquivos). */
  itensRemovidos: string[];
}

export interface EdicaoStorageDados {
  caixas: { id: string; ordem: number }[];
  itens: { id: string; storage_id: string; ordem: number }[];
  renomeacoes: { id: string; nome: string }[];
  caixasExcluidas: string[];
  itensExcluidos: string[];
}

export interface InserirExecucaoDados {
  /** Id da linha de histórico, gerado no aparelho. */
  id: string;
  tarefaId: string;
  dataExecucao: string;
  dataPrevista: string | null;
  base: BaseProximaExecucao;
  /** Quem fez (uma ou mais pessoas). */
  pessoaIds: string[];
}

export interface DefinirPessoasExecucaoDados {
  historicoId: string;
  pessoaIds: string[];
}

export interface AtualizarExecucaoDados {
  id: string;
  tarefaId: string;
  dataExecucao?: string;
  base?: BaseProximaExecucao;
}

export interface ExcluirExecucaoDados {
  id: string;
  tarefaId: string;
}

export interface DefinirAdiamentoDados {
  tarefaId: string;
  /** Data para onde a tarefa foi adiada (ou pulada); null cancela o adiamento. */
  adiadaAte: string | null;
}
