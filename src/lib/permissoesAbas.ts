import { ABAS_PADRAO, type AbaPadrao, type GrupoAbas } from './abas';

/**
 * Permissões por aba (Settings > Usuários). Valem só na interface: o banco continua aberto a qualquer
 * login autenticado (aplicar no banco está no backlog). Admin vê e edita tudo; para os demais, sem
 * linha é não ver e não editar.
 */

export type CampoPermissao = 'ver' | 'editar';

export interface Permissao {
  ver: boolean;
  editar: boolean;
}

/** Permissões por chave de aba (`principal:financas`, `financas:resumo`...). */
export type Permissoes = Record<string, Permissao>;

/**
 * Todos acessam, sempre (cada um edita o próprio nome, e-mail e ícone; papel, vínculo, convite e exclusão
 * continuam só para admin, travados na própria tela e no banco). Não entra na tabela de permissões.
 */
export const ABA_SEMPRE_LIBERADA = 'settings:usuarios';

/** Todos veem (cada um confere seus casais), mas só admin edita. Também fica fora da tabela de permissões. */
export const ABA_SO_VISUALIZAR = 'settings:casais';

/** Principal que tem subabas, e o grupo delas. */
const GRUPO_DAS_SUBABAS: Record<string, GrupoAbas> = {
  'principal:financas': 'financas',
  'principal:apartamento': 'apartamento',
  'principal:documentos': 'documentos',
  'principal:settings': 'settings',
};

export const ICONES_PERMISSAO = {
  ver: { ligado: 'HSR/Icon Reality.png', desligado: 'HSR/Icon Dreamscape.png' },
  editar: {
    ligado: 'Warnings/UI_Icon_LanV6DanmakuChallengeEndDialog_Deblocking_Unlock 2.png',
    desligado: 'Warnings/UI_Icon_LanV6DanmakuChallengeEndDialog_Deblocking_Lock 2.png',
  },
} as const;

export const MENSAGEM_SEM_PERMISSAO_PARA_EDITAR = 'Você não tem permissão para editar esta aba.';

export interface LinhaPermissao {
  principal: AbaPadrao;
  subabas: AbaPadrao[];
}

/** Abas principais, cada uma com as subabas (menos as só de admin), na ordem padrão. */
export function linhasDePermissao(): LinhaPermissao[] {
  return ABAS_PADRAO.principal.map((principal) => {
    const grupo = GRUPO_DAS_SUBABAS[principal.chave];
    return { principal, subabas: grupo ? ABAS_PADRAO[grupo].filter((a) => a.chave !== ABA_SEMPRE_LIBERADA && a.chave !== ABA_SO_VISUALIZAR) : [] };
  });
}

export function chavesDaTabela(): string[] {
  return linhasDePermissao().flatMap((l) => [l.principal.chave, ...l.subabas.map((s) => s.chave)]);
}

function subabasDe(chavePrincipal: string): AbaPadrao[] {
  return linhasDePermissao().find((l) => l.principal.chave === chavePrincipal)?.subabas ?? [];
}

export function permissaoDe(permissoes: Permissoes, chave: string): Permissao {
  return permissoes[chave] ?? { ver: false, editar: false };
}

/**
 * Clique num botão da tabela: liga ou desliga aquele campo. "Editar" liga "ver" junto, e desligar "ver"
 * desliga "editar". Na aba principal o novo valor é copiado para as subabas; depois cada subaba pode
 * ser ajustada sozinha, sem mexer na principal.
 */
export function alternarPermissao(permissoes: Permissoes, chave: string, campo: CampoPermissao): Permissoes {
  const novo = !permissaoDe(permissoes, chave)[campo];
  const alvos = [chave, ...subabasDe(chave).map((s) => s.chave)];
  const resultado: Permissoes = { ...permissoes };
  for (const alvo of alvos) {
    const atual = permissaoDe(permissoes, alvo);
    resultado[alvo] = campo === 'ver' ? { ver: novo, editar: novo ? atual.editar : false } : { ver: novo ? true : atual.ver, editar: novo };
  }
  return resultado;
}

/** A aba aparece no menu e abre? A principal aparece se ela ou alguma subaba tem "ver" (Settings sempre aparece, por causa de Usuários). */
export function podeVerAba(permissoes: Permissoes, admin: boolean, chave: string): boolean {
  if (admin || chave === ABA_SEMPRE_LIBERADA || chave === ABA_SO_VISUALIZAR) return true;
  if (chave in GRUPO_DAS_SUBABAS) {
    const temAbaLiberada = ABAS_PADRAO[GRUPO_DAS_SUBABAS[chave]].some((a) => a.chave === ABA_SEMPRE_LIBERADA);
    return temAbaLiberada || permissaoDe(permissoes, chave).ver || subabasDe(chave).some((s) => permissaoDe(permissoes, s.chave).ver);
  }
  return permissaoDe(permissoes, chave).ver;
}

export function podeEditarAba(permissoes: Permissoes, admin: boolean, chave: string): boolean {
  if (admin || chave === ABA_SEMPRE_LIBERADA) return true;
  if (chave === ABA_SO_VISUALIZAR) return false;
  return permissaoDe(permissoes, chave).editar;
}

const CHAVES_CONHECIDAS = new Set([...ABAS_PADRAO.principal, ...ABAS_PADRAO.settings, ...ABAS_PADRAO.financas, ...ABAS_PADRAO.apartamento, ...ABAS_PADRAO.documentos].map((a) => a.chave));

/**
 * Aba a que um endereço pertence (sem o prefixo do app), ou null para endereços que só redirecionam
 * (ex.: `/documentos`) ou que não são de nenhuma aba.
 */
export function chaveDaRota(caminho: string): string | null {
  const [a, b, c] = caminho.split('/').filter(Boolean);
  let chave: string | null = null;
  if (a === 'hoje') chave = 'principal:hoje';
  else if (a === 'storage') chave = 'principal:storage';
  else if (a === 'financas') chave = b === 'resumo-geral' || b === 'parcelamentos' ? `financas:${b}` : c ? `financas:${c}` : null;
  else if (a === 'apartamento') chave = b ? `apartamento:${b === 'manutencao' ? 'tarefas' : b}` : null;
  else if (a === 'documentos') chave = b ? `documentos:${b}` : null;
  else if (a === 'settings') chave = b ? `settings:${b}` : null;
  return chave && CHAVES_CONHECIDAS.has(chave) ? chave : null;
}

/** Tira o prefixo do app (`/personal-organizer/`) do endereço do navegador. */
export function caminhoSemBase(caminho: string, base: string): string {
  const prefixo = base.replace(/\/$/, '');
  return prefixo && caminho.startsWith(prefixo) ? caminho.slice(prefixo.length) || '/' : caminho;
}
