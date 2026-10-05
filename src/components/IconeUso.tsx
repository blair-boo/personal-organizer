import { IconePng, IconeSupabase } from './IconeSupabase';
import { PROVISORIOS_FUNCAO } from './IconesProvisorios';
import { useAbasEdicaoOpcional } from './AbasEdicao';
import { useIconesUsos } from '../hooks/useIconesUsos';
import { useTemaEfetivo } from '../hooks/useTema';
import { definicaoDaFuncao, ICONE_PLACEHOLDER, usoPadraoDaFuncao, type FuncaoIcone } from '../lib/iconesFuncoes';
import { caminhoDoUso, corCssDoUso, resolverUso, tamanhoDoUso } from '../lib/iconesUsos';
import type { AlvoIcone, UsoIcone } from '../types';

/** Desenha um uso de ícone: com máscara (cor do lugar, de um token ou salva) ou imagem original. */
export function IconeDoUso({ uso, tamanhoBase, titulo }: { uso: UsoIcone; tamanhoBase: number; titulo?: string }) {
  const tamanho = tamanhoDoUso(uso, tamanhoBase);
  const caminho = caminhoDoUso(uso);
  if (uso.mascara) return <IconeSupabase arquivo={caminho} tamanho={tamanho} cor={corCssDoUso(uso)} titulo={titulo} />;
  return <IconePng arquivo={caminho} tamanho={tamanho} titulo={titulo} />;
}

/**
 * Ícone de uma função (salvar, editar, excluir...). Vale para o app todo: trocar em
 * Ícones (Settings) muda em todo lugar. O nome da função aparece ao passar o mouse.
 */
export function IconeFuncao({ funcao, tamanho = 16 }: { funcao: FuncaoIcone; tamanho?: number }) {
  const { data: usos = [] } = useIconesUsos();
  const tema = useTemaEfetivo();
  const rotulo = definicaoDaFuncao(funcao)?.rotulo;
  const uso = resolverUso(usos, 'funcao', funcao, tema) ?? usoPadraoDaFuncao(funcao);
  if (uso) return <IconeDoUso uso={uso} tamanhoBase={tamanho} titulo={rotulo} />;
  const Provisorio = PROVISORIOS_FUNCAO[funcao];
  return Provisorio ? <span title={rotulo}>{Provisorio({ tamanho })}</span> : null;
}

interface IconeUsoProps {
  alvoTipo: Exclude<AlvoIcone, 'funcao'>;
  alvoId: string;
  /** Nome do título que o ícone ilustra, para os rótulos de acessibilidade. */
  rotulo: string;
  tamanhoBase?: number;
  /** No modo de edição, sem ícone aparece o placeholder e o clique abre a troca. */
  modoEdicao?: boolean;
  onEditar?: () => void;
}

/** Ícone que ilustra um título (categoria, aba). Sem ícone: só aparece algo no modo de edição. */
export function IconeUso({ alvoTipo, alvoId, rotulo, tamanhoBase = 18, modoEdicao = false, onEditar }: IconeUsoProps) {
  const { data: usos = [] } = useIconesUsos();
  const tema = useTemaEfetivo();
  const edicaoAbas = useAbasEdicaoOpcional();
  const rascunho = alvoTipo === 'aba' && edicaoAbas?.editando ? edicaoAbas.usoRascunho(alvoId) : undefined;
  const uso = rascunho !== undefined ? rascunho : resolverUso(usos, alvoTipo, alvoId, tema);

  if (!uso && !modoEdicao) return null;

  const conteudo = uso ? (
    <IconeDoUso uso={uso} tamanhoBase={tamanhoBase} />
  ) : (
    <IconeSupabase arquivo={ICONE_PLACEHOLDER} tamanho={tamanhoBase} />
  );

  if (modoEdicao && onEditar) {
    const texto = uso ? `Alterar ícone de ${rotulo}` : `Escolher ícone para ${rotulo}`;
    return (
      <button type="button" className="btn-icone icone-uso-botao" onClick={onEditar} title={texto} aria-label={texto}>
        {conteudo}
      </button>
    );
  }
  return <span className="icone-uso">{conteudo}</span>;
}
