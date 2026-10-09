import type { AbaConfig } from '../types';

export interface AbaPadrao {
  /** Chave estável (nunca muda): `grupo:nome`. A rota não é editável, só nome, ícone e ordem. */
  chave: string;
  rotulo: string;
}

export type GrupoAbas = 'principal' | 'settings' | 'financas' | 'apartamento' | 'documentos';

export const ROTULOS_GRUPOS: Record<GrupoAbas, string> = {
  principal: 'Abas principais',
  settings: 'Abas de Settings',
  financas: 'Abas de Finanças',
  apartamento: 'Abas de Apartamento',
  documentos: 'Abas de Documentos',
};

/** Abas na ordem padrão, por grupo. */
export const ABAS_PADRAO: Record<GrupoAbas, AbaPadrao[]> = {
  principal: [
    { chave: 'principal:financas', rotulo: 'Finanças' },
    { chave: 'principal:apartamento', rotulo: 'Apartamento' },
    { chave: 'principal:documentos', rotulo: 'Documentos' },
    { chave: 'principal:settings', rotulo: 'Settings' },
  ],
  settings: [
    { chave: 'settings:categorias', rotulo: 'Categorias' },
    { chave: 'settings:icones', rotulo: 'Ícones' },
    { chave: 'settings:contas', rotulo: 'Contas e Cartões' },
    { chave: 'settings:banco-lancamentos', rotulo: 'Banco de Lançamentos' },
    { chave: 'settings:classificacoes-tarefas', rotulo: 'Classificações de Tarefas' },
    { chave: 'settings:calendario', rotulo: 'Calendário' },
    { chave: 'settings:backup', rotulo: 'Backup' },
    { chave: 'settings:app', rotulo: 'App' },
  ],
  financas: [
    { chave: 'financas:conta-corrente', rotulo: 'Conta Corrente' },
    { chave: 'financas:cartao-credito', rotulo: 'Cartão de Crédito' },
    { chave: 'financas:resumo', rotulo: 'Resumo do Mês' },
    { chave: 'financas:resumo-geral', rotulo: 'Resumo Geral' },
    { chave: 'financas:parcelamentos', rotulo: 'Parcelamentos' },
  ],
  apartamento: [
    { chave: 'apartamento:itens', rotulo: 'Itens' },
    { chave: 'apartamento:projetos', rotulo: 'Projetos' },
    { chave: 'apartamento:manutencao', rotulo: 'Manutenção' },
  ],
  documentos: [
    { chave: 'documentos:pessoais', rotulo: 'Pessoais' },
    { chave: 'documentos:apartamento', rotulo: 'Apartamento' },
    { chave: 'documentos:arquivo', rotulo: 'Arquivo' },
    { chave: 'documentos:outros', rotulo: 'Outros' },
  ],
};

export interface AbaResolvida extends AbaPadrao {
  /** Nome exibido; '' = só o ícone. */
  nome: string;
}

/**
 * Aplica nome e ordem salvos sobre as abas padrão. Abas sem configuração mantêm
 * a posição padrão; as configuradas vêm pela ordem salva (empate: ordem padrão).
 */
export function resolverAbas(grupo: GrupoAbas, configs: AbaConfig[]): AbaResolvida[] {
  const porChave = new Map(configs.map((c) => [c.chave, c]));
  return ABAS_PADRAO[grupo]
    .map((aba, indicePadrao) => {
      const cfg = porChave.get(aba.chave);
      return {
        aba,
        indicePadrao,
        ordem: cfg ? cfg.ordem : indicePadrao,
        nome: cfg && cfg.nome !== null ? cfg.nome : aba.rotulo,
      };
    })
    .sort((a, b) => a.ordem - b.ordem || a.indicePadrao - b.indicePadrao)
    .map(({ aba, nome }) => ({ ...aba, nome }));
}

/**
 * Regra do modo de edição: nome vazio só vale se a aba tiver ícone
 * (aí aparece só o ícone); sem ícone o nome é obrigatório.
 */
export function nomeVazioInvalido(nome: string, temIcone: boolean): boolean {
  return nome.trim() === '' && !temIcone;
}
