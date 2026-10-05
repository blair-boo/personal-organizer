import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import { useDialogos } from './Dialogo';
import { useToast } from './Toast';
import { useAbasConfig, useSalvarAbasConfig } from '../hooks/useAbasConfig';
import { useAplicarUsosIcone, useIconesUsos } from '../hooks/useIconesUsos';
import { useTemaEfetivo } from '../hooks/useTema';
import { ABAS_PADRAO, nomeVazioInvalido, resolverAbas, type AbaResolvida, type GrupoAbas } from '../lib/abas';
import { resolverUso } from '../lib/iconesUsos';
import { mensagemDeErro } from '../lib/erros';
import type { AbaConfig, UsoIcone } from '../types';

interface AbasEdicaoContexto {
  editando: boolean;
  salvando: boolean;
  temAlteracoes: boolean;
  iniciar: () => void;
  /** Sai do modo de edição; com alterações pendentes pergunta antes de descartar. */
  cancelar: () => Promise<void>;
  salvar: () => Promise<void>;
  nomeRascunho: (chave: string) => string | undefined;
  setNome: (chave: string, nome: string) => void;
  ordemRascunho: (grupo: GrupoAbas) => string[] | undefined;
  setOrdem: (grupo: GrupoAbas, chaves: string[]) => void;
  /** undefined = sem alteração; null = ícone removido; uso = ícone novo. */
  usoRascunho: (chave: string) => UsoIcone | null | undefined;
  setUso: (chave: string, uso: UsoIcone | null) => void;
}

const Contexto = createContext<AbasEdicaoContexto | null>(null);

const GRUPOS = Object.keys(ABAS_PADRAO) as GrupoAbas[];

/** Modo de edição das abas (nome, ícone e ordem): alterações ficam em rascunho até salvar. */
export function AbasEdicaoProvider({ children }: { children: ReactNode }) {
  const { confirmar } = useDialogos();
  const { mostrarToast } = useToast();
  const { data: configs = [] } = useAbasConfig();
  const { data: usos = [] } = useIconesUsos();
  const tema = useTemaEfetivo();
  const salvarConfigs = useSalvarAbasConfig();
  const aplicarUsos = useAplicarUsosIcone();

  const [editando, setEditando] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [nomes, setNomes] = useState<Record<string, string>>({});
  const [ordens, setOrdens] = useState<Partial<Record<GrupoAbas, string[]>>>({});
  const [usosRascunho, setUsosRascunho] = useState<Record<string, UsoIcone | null>>({});

  const temAlteracoes = Object.keys(nomes).length > 0 || Object.keys(ordens).length > 0 || Object.keys(usosRascunho).length > 0;

  const limpar = useCallback(() => {
    setEditando(false);
    setNomes({});
    setOrdens({});
    setUsosRascunho({});
  }, []);

  const temIcone = useCallback(
    (chave: string): boolean => {
      if (chave in usosRascunho) return usosRascunho[chave] !== null;
      return resolverUso(usos, 'aba', chave, tema) !== null;
    },
    [usosRascunho, usos, tema]
  );

  function listaDoGrupo(grupo: GrupoAbas): AbaResolvida[] {
    let abas = resolverAbas(grupo, configs);
    const ordem = ordens[grupo];
    if (ordem) abas = ordem.map((c) => abas.find((a) => a.chave === c)).filter((a): a is AbaResolvida => !!a);
    return abas.map((a) => ({ ...a, nome: nomes[a.chave] ?? a.nome }));
  }

  async function salvar() {
    if (!temAlteracoes) {
      limpar();
      return;
    }
    for (const grupo of GRUPOS) {
      const invalida = listaDoGrupo(grupo).find((a) => nomeVazioInvalido(a.nome, temIcone(a.chave)));
      if (invalida) {
        mostrarToast(`Dê um nome à aba ${invalida.rotulo} ou escolha um ícone para ela.`, 'erro');
        return;
      }
    }
    setSalvando(true);
    try {
      const novasConfigs: AbaConfig[] = [];
      for (const grupo of GRUPOS) {
        const tocou = ordens[grupo] || ABAS_PADRAO[grupo].some((a) => a.chave in nomes);
        if (!tocou) continue;
        listaDoGrupo(grupo).forEach((a, indice) => {
          const padrao = ABAS_PADRAO[grupo].find((p) => p.chave === a.chave)!;
          const nome = a.nome.trim();
          novasConfigs.push({ chave: a.chave, nome: nome === padrao.rotulo ? null : nome, ordem: indice });
        });
      }
      await salvarConfigs.mutateAsync(novasConfigs);
      const mudancasIcones = Object.entries(usosRascunho).map(([chave, uso]) => ({ alvoTipo: 'aba' as const, alvoId: chave, uso }));
      if (mudancasIcones.length > 0) await aplicarUsos.mutateAsync(mudancasIcones);
      mostrarToast('Abas salvas.');
      limpar();
    } catch (err) {
      mostrarToast(mensagemDeErro(err), 'erro');
    } finally {
      setSalvando(false);
    }
  }

  async function cancelar() {
    if (temAlteracoes) {
      const ok = await confirmar({
        titulo: 'Descartar alterações?',
        mensagem: 'Os nomes, ícones e a ordem das abas alterados agora serão perdidos.',
        confirmarRotulo: 'Descartar',
        perigoso: true,
      });
      if (!ok) return;
    }
    limpar();
  }

  const valor = useMemo<AbasEdicaoContexto>(
    () => ({
      editando,
      salvando,
      temAlteracoes,
      iniciar: () => setEditando(true),
      cancelar,
      salvar,
      nomeRascunho: (chave) => nomes[chave],
      setNome: (chave, nome) => setNomes((atual) => ({ ...atual, [chave]: nome })),
      ordemRascunho: (grupo) => ordens[grupo],
      setOrdem: (grupo, chaves) => setOrdens((atual) => ({ ...atual, [grupo]: chaves })),
      usoRascunho: (chave) => (chave in usosRascunho ? usosRascunho[chave] : undefined),
      setUso: (chave, uso) => setUsosRascunho((atual) => ({ ...atual, [chave]: uso })),
    }),
    // cancelar e salvar leem o estado atual a cada render; o contexto precisa refletir isso.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [editando, salvando, temAlteracoes, nomes, ordens, usosRascunho, configs, usos, tema]
  );

  return <Contexto.Provider value={valor}>{children}</Contexto.Provider>;
}

export function useAbasEdicaoOpcional(): AbasEdicaoContexto | null {
  return useContext(Contexto);
}

export function useAbasEdicao(): AbasEdicaoContexto {
  const ctx = useContext(Contexto);
  if (!ctx) throw new Error('useAbasEdicao precisa estar dentro de AbasEdicaoProvider.');
  return ctx;
}

/** Abas de um grupo já com nome e ordem salvos, e com o rascunho por cima enquanto o modo de edição está ativo. */
export function useAbasDoGrupo(grupo: GrupoAbas): AbaResolvida[] {
  const { data: configs = [] } = useAbasConfig();
  const ctx = useAbasEdicaoOpcional();
  let abas = resolverAbas(grupo, configs);
  if (ctx?.editando) {
    const ordem = ctx.ordemRascunho(grupo);
    if (ordem) abas = ordem.map((c) => abas.find((a) => a.chave === c)).filter((a): a is AbaResolvida => !!a);
    abas = abas.map((a) => ({ ...a, nome: ctx.nomeRascunho(a.chave) ?? a.nome }));
  }
  return abas;
}
