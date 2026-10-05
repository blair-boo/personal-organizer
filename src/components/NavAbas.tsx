import type { ReactNode } from 'react';
import { NavLink } from 'react-router-dom';
import { IconeUso } from './IconeUso';
import { useAbasDoGrupo, useAbasEdicaoOpcional } from './AbasEdicao';
import { useIconesUsos } from '../hooks/useIconesUsos';
import { useTemaEfetivo } from '../hooks/useTema';
import { resolverUso } from '../lib/iconesUsos';
import type { GrupoAbas } from '../lib/abas';

interface NavAbasProps {
  grupo: GrupoAbas;
  /** Classe do <nav> (app-nav ou app-subnav). */
  className: string;
  /** Rota de cada aba, pela chave estável. */
  rota: (chave: string) => string;
  /** Conteúdo extra no fim da barra (ex.: botão do modo de edição). */
  children?: ReactNode;
}

/** Barra de abas com nome, ícone e ordem configuráveis (Settings > modo de edição das abas). */
export function NavAbas({ grupo, className, rota, children }: NavAbasProps) {
  const abas = useAbasDoGrupo(grupo);
  const { data: usos = [] } = useIconesUsos();
  const tema = useTemaEfetivo();
  const edicao = useAbasEdicaoOpcional();

  return (
    <nav className={className}>
      {abas.map((aba) => {
        const rascunho = edicao?.editando ? edicao.usoRascunho(aba.chave) : undefined;
        const temIcone = rascunho !== undefined ? rascunho !== null : resolverUso(usos, 'aba', aba.chave, tema) !== null;
        // Sem nome e sem ícone nunca deve acontecer (o salvar bloqueia), mas se acontecer mostra o nome padrão.
        const texto = aba.nome || (temIcone ? '' : aba.rotulo);
        return (
          <NavLink key={aba.chave} to={rota(aba.chave)} className="aba-link" title={aba.nome || aba.rotulo} aria-label={aba.nome || aba.rotulo}>
            <IconeUso alvoTipo="aba" alvoId={aba.chave} rotulo={aba.rotulo} tamanhoBase={16} />
            {texto && <span>{texto}</span>}
          </NavLink>
        );
      })}
      {children}
    </nav>
  );
}
