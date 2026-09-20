import { useState, type KeyboardEvent } from 'react';
import { DndContext, PointerSensor, closestCenter, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core';
import { SortableContext, arrayMove, rectSortingStrategy, useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { useDialogos } from '../../components/Dialogo';
import { useToast } from '../../components/Toast';
import { IconePng, IconeSupabase } from '../../components/IconeSupabase';
import { mensagemDeErro } from '../../lib/erros';
import { ehIconeMascarado, iconesDaCategoria } from '../../lib/iconesCategorias';
import { TagsItensSecao } from './TagsItensSecao';
import {
  useCategorias,
  useCriarCategoria,
  useExcluirCategoria,
  useRenomearCategoria,
  useReordenarCategorias,
  useUsoCategorias,
} from '../../hooks/useCategorias';
import type { Categoria, TipoCategoria } from '../../types';

function IconeGrip() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
      <path d="M3 6h18" />
      <path d="M3 12h18" />
      <path d="M3 18h18" />
    </svg>
  );
}

function ItemLinha({
  item,
  nomeExibido,
  renomeacaoPendente,
  uso,
  isRaiz,
  subCount,
  expandido,
  modoEdicao,
  pendente,
  editando,
  rascunho,
  onNomeClick,
  onRascunhoChange,
  onConfirmarEdicao,
  onCancelarEdicao,
  onMarcarExclusao,
  onDesfazerExclusao,
  onAdicionarSubcategoria,
}: {
  item: Categoria;
  nomeExibido: string;
  renomeacaoPendente: boolean;
  uso: number;
  isRaiz: boolean;
  subCount?: number;
  expandido?: boolean;
  modoEdicao: boolean;
  pendente: boolean;
  editando: boolean;
  rascunho: string;
  onNomeClick: () => void;
  onRascunhoChange: (v: string) => void;
  onConfirmarEdicao: () => void;
  onCancelarEdicao: () => void;
  onMarcarExclusao: () => void;
  onDesfazerExclusao: () => void;
  onAdicionarSubcategoria?: () => void;
}) {
  const sortable = useSortable({ id: item.id });
  const style = { transform: CSS.Transform.toString(sortable.transform), transition: sortable.transition };
  const icones = isRaiz ? iconesDaCategoria(item.nome) : [];

  function handleKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') {
      e.preventDefault();
      onConfirmarEdicao();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      onCancelarEdicao();
    }
  }

  if (editando) {
    return (
      <div ref={sortable.setNodeRef} style={style} className="categorias-item categorias-item-editando">
        <input value={rascunho} onChange={(e) => onRascunhoChange(e.target.value)} onKeyDown={handleKeyDown} autoFocus aria-label={`Renomear ${nomeExibido}`} />
        <button type="button" className="btn-icone" onClick={onConfirmarEdicao} title="Confirmar" aria-label="Confirmar">
          ✓
        </button>
        <button type="button" className="btn-icone" onClick={onCancelarEdicao} title="Cancelar" aria-label="Cancelar">
          ×
        </button>
      </div>
    );
  }

  return (
    <div
      ref={sortable.setNodeRef}
      style={style}
      className={`categorias-item${pendente ? ' categorias-item-pendente' : ''}${renomeacaoPendente ? ' categorias-item-renomeado' : ''}`}
    >
      {modoEdicao && !pendente && (
        <button type="button" className="btn-icone categorias-arrastar" aria-label={`Arrastar ${nomeExibido}`} {...sortable.attributes} {...sortable.listeners}>
          <IconeGrip />
        </button>
      )}
      {icones.length > 0 && (
        <span className="categorias-icones-raiz">
          {icones.map((arquivo) =>
            ehIconeMascarado(arquivo) ? (
              <IconeSupabase key={arquivo} arquivo={arquivo} tamanho={18} />
            ) : (
              <IconePng key={arquivo} arquivo={arquivo} tamanho={18} />
            )
          )}
        </span>
      )}
      <button
        type="button"
        className={`categorias-nome${isRaiz ? ' categorias-raiz-clicavel' : ''}`}
        onClick={onNomeClick}
        disabled={pendente || (!modoEdicao && !isRaiz)}
      >
        <span className="categorias-nome-texto">
          {isRaiz && <span className="categorias-seta">{expandido ? '▾' : '▸'}</span>}
          {nomeExibido}
        </span>
        {isRaiz && subCount != null && <span className="categorias-contagem-subs">({subCount})</span>}
      </button>
      {uso > 0 && (
        <span className="categorias-uso" title={`Usada em ${uso} lançamento(s)`}>
          {uso}
        </span>
      )}
      {onAdicionarSubcategoria && (
        <button type="button" className="btn-icone" onClick={onAdicionarSubcategoria} disabled={pendente} title={`Nova subcategoria em ${nomeExibido}`} aria-label={`Nova subcategoria em ${nomeExibido}`}>
          +
        </button>
      )}
      {modoEdicao && (
        pendente ? (
          <button type="button" className="categorias-btn-desfazer" onClick={onDesfazerExclusao} title={`Desfazer exclusão de ${nomeExibido}`}>
            Desfazer
          </button>
        ) : (
          <button type="button" className="btn-icone btn-icone-perigo" onClick={onMarcarExclusao} title={`Excluir ${nomeExibido}`} aria-label={`Excluir ${nomeExibido}`}>
            <IconeSupabase arquivo="trash3.svg" />
          </button>
        )
      )}
    </div>
  );
}

export function CategoriasPage() {
  const [tipo, setTipo] = useState<TipoCategoria>('despesa');
  const [mostrarTagsItens, setMostrarTagsItens] = useState(false);
  const { data: categorias } = useCategorias(tipo);
  const { data: uso } = useUsoCategorias();
  const criar = useCriarCategoria(tipo);
  const renomear = useRenomearCategoria(tipo);
  const excluir = useExcluirCategoria(tipo);
  const reordenar = useReordenarCategorias(tipo);
  const { confirmar, pedirTexto } = useDialogos();
  const { mostrarToast } = useToast();

  const [busca, setBusca] = useState('');
  const [edicaoAtivaId, setEdicaoAtivaId] = useState<string | null>(null);
  const [rascunho, setRascunho] = useState('');
  const [modoEdicao, setModoEdicao] = useState(false);
  const [ordemLocal, setOrdemLocal] = useState<Categoria[] | null>(null);
  const [exclusoesPendentes, setExclusoesPendentes] = useState<Set<string>>(new Set());
  const [renomeacoesPendentes, setRenomeacoesPendentes] = useState<Map<string, string>>(new Map());
  const [colapsados, setColapsados] = useState<Set<string>>(new Set());
  const [salvando, setSalvando] = useState(false);
  const haAlteracoesOrdem = ordemLocal !== null;
  const temPendencias = haAlteracoesOrdem || exclusoesPendentes.size > 0 || renomeacoesPendentes.size > 0;

  function nomeAtual(item: Categoria): string {
    return renomeacoesPendentes.get(item.id) ?? item.nome;
  }

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  const dados = ordemLocal ?? categorias ?? [];
  const q = haAlteracoesOrdem ? '' : busca.trim().toLowerCase();
  const paiPorId = new Map(dados.map((c) => [c.id, c]));

  const raizesTodas = dados.filter((c) => !c.parent_id).sort((a, b) => a.ordem - b.ordem || a.nome.localeCompare(b.nome));
  const raizes = !q
    ? raizesTodas
    : raizesTodas.filter((r) => {
        if (r.nome.toLowerCase().includes(q)) return true;
        return dados.some((c) => c.parent_id === r.id && c.nome.toLowerCase().includes(q));
      });

  function subcategoriasDe(raizId: string): Categoria[] {
    const todas = dados.filter((c) => c.parent_id === raizId).sort((a, b) => a.ordem - b.ordem || a.nome.localeCompare(b.nome));
    if (!q) return todas;
    const raiz = paiPorId.get(raizId);
    if (raiz && raiz.nome.toLowerCase().includes(q)) return todas;
    return todas.filter((c) => c.nome.toLowerCase().includes(q));
  }

  function iniciarEdicao(item: Categoria) {
    setEdicaoAtivaId(item.id);
    setRascunho(nomeAtual(item));
  }

  function cancelarEdicao() {
    setEdicaoAtivaId(null);
    setRascunho('');
  }

  function confirmarEdicao(item: Categoria) {
    const novo = rascunho.trim();
    cancelarEdicao();
    if (!novo || novo === nomeAtual(item)) return;
    setRenomeacoesPendentes((atual) => {
      const novoMapa = new Map(atual);
      if (novo === item.nome) {
        novoMapa.delete(item.id);
      } else {
        novoMapa.set(item.id, novo);
      }
      return novoMapa;
    });
  }

  function alternarExpandir(raizId: string) {
    setColapsados((atual) => {
      const novo = new Set(atual);
      if (novo.has(raizId)) novo.delete(raizId);
      else novo.add(raizId);
      return novo;
    });
  }

  function marcarExclusao(item: Categoria) {
    setExclusoesPendentes((atual) => {
      const novo = new Set(atual);
      novo.add(item.id);
      if (!item.parent_id) {
        for (const c of dados) {
          if (c.parent_id === item.id) novo.add(c.id);
        }
      }
      return novo;
    });
  }

  function desfazerExclusao(item: Categoria) {
    setExclusoesPendentes((atual) => {
      const novo = new Set(atual);
      novo.delete(item.id);
      if (!item.parent_id) {
        for (const c of dados) {
          if (c.parent_id === item.id) novo.delete(c.id);
        }
      }
      return novo;
    });
  }

  async function adicionarRaiz() {
    const nome = await pedirTexto({ titulo: 'Nova categoria', mensagem: 'Nome' });
    if (!nome?.trim()) return;
    try {
      await criar.mutateAsync({ nome: nome.trim(), parentId: null });
    } catch (err) {
      mostrarToast(mensagemDeErro(err), 'erro');
    }
  }

  async function adicionarSubcategoria(raiz: Categoria) {
    const nome = await pedirTexto({ titulo: `Nova subcategoria em ${raiz.nome}`, mensagem: 'Nome' });
    if (!nome?.trim()) return;
    try {
      await criar.mutateAsync({ nome: nome.trim(), parentId: raiz.id });
    } catch (err) {
      mostrarToast(mensagemDeErro(err), 'erro');
    }
  }

  function entrarModoEdicao() {
    setModoEdicao(true);
  }

  function sairModoEdicao() {
    setModoEdicao(false);
    setOrdemLocal(null);
    setExclusoesPendentes(new Set());
    setRenomeacoesPendentes(new Map());
    cancelarEdicao();
  }

  function alternarModoEdicao() {
    if (modoEdicao) sairModoEdicao();
    else entrarModoEdicao();
  }

  async function salvarAlteracoes() {
    if (!temPendencias) return;
    if (exclusoesPendentes.size > 0) {
      const usoTotal = [...exclusoesPendentes].reduce((soma, id) => soma + (uso?.get(id) ?? 0), 0);
      const ok = await confirmar({
        titulo: `Excluir ${exclusoesPendentes.size} categoria(s)?`,
        mensagem:
          usoTotal > 0
            ? `Usadas em ${usoTotal} lançamento(s) no total — eles ficam sem categoria. Essa ação não pode ser desfeita.`
            : 'Essa ação não pode ser desfeita.',
        confirmarRotulo: 'Excluir e salvar',
        perigoso: true,
      });
      if (!ok) return;
    }
    setSalvando(true);
    try {
      if (ordemLocal) {
        await reordenar.mutateAsync(ordemLocal.map((c) => ({ id: c.id, ordem: c.ordem })));
      }
      for (const [id, nome] of renomeacoesPendentes) {
        if (exclusoesPendentes.has(id)) continue;
        await renomear.mutateAsync({ id, nome });
      }
      for (const id of exclusoesPendentes) {
        await excluir.mutateAsync(id);
      }
      mostrarToast('Alterações salvas.');
      sairModoEdicao();
    } catch (err) {
      mostrarToast(mensagemDeErro(err), 'erro');
    } finally {
      setSalvando(false);
    }
  }

  function onDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const base = ordemLocal ?? categorias ?? [];
    const ativoId = String(active.id);
    const sobreId = String(over.id);
    const item = base.find((c) => c.id === ativoId);
    if (!item) return;
    setBusca('');

    if (!item.parent_id) {
      const raizesAtuais = base.filter((c) => !c.parent_id).sort((a, b) => a.ordem - b.ordem);
      const oldIndex = raizesAtuais.findIndex((c) => c.id === ativoId);
      const newIndex = raizesAtuais.findIndex((c) => c.id === sobreId);
      if (oldIndex < 0 || newIndex < 0) return;
      const reordenadas = arrayMove(raizesAtuais, oldIndex, newIndex).map((c, i) => ({ ...c, ordem: i + 1 }));
      const outras = base.filter((c) => c.parent_id);
      setOrdemLocal([...reordenadas, ...outras]);
    } else {
      const irmas = base.filter((c) => c.parent_id === item.parent_id).sort((a, b) => a.ordem - b.ordem);
      const oldIndex = irmas.findIndex((c) => c.id === ativoId);
      const newIndex = irmas.findIndex((c) => c.id === sobreId);
      if (oldIndex < 0 || newIndex < 0) return;
      const reordenadas = arrayMove(irmas, oldIndex, newIndex).map((c, i) => ({ ...c, ordem: i + 1 }));
      const outras = base.filter((c) => c.parent_id !== item.parent_id);
      setOrdemLocal([...outras, ...reordenadas]);
    }
  }

  return (
    <div className="categorias-pagina">
      <div className="categorias-topo">
        <div className="categorias-cabecalho">
          <h1>Categorias</h1>
          <p className="categorias-subtitulo">
            Clique no ícone de vassoura pra entrar no modo de edição — aí dá pra arrastar, renomear e excluir. As
            alterações só ficam definitivas ao clicar em salvar e confirmar.
          </p>
        </div>

        <nav className="abas-internas">
          <button
            type="button"
            className={!mostrarTagsItens && tipo === 'despesa' ? 'ativa' : ''}
            onClick={() => {
              setMostrarTagsItens(false);
              setTipo('despesa');
            }}
            disabled={modoEdicao}
          >
            Despesas
          </button>
          <button
            type="button"
            className={!mostrarTagsItens && tipo === 'receita' ? 'ativa' : ''}
            onClick={() => {
              setMostrarTagsItens(false);
              setTipo('receita');
            }}
            disabled={modoEdicao}
          >
            Receitas
          </button>
          <button
            type="button"
            className={mostrarTagsItens ? 'ativa' : ''}
            onClick={() => setMostrarTagsItens(true)}
            disabled={modoEdicao}
          >
            Tags de Itens
          </button>
        </nav>

        {!mostrarTagsItens && (
          <div className="categorias-busca-linha">
            <input
              type="search"
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Buscar categorias…"
              className="categorias-busca"
              aria-label="Buscar categorias"
              disabled={haAlteracoesOrdem}
            />
            <button type="button" onClick={adicionarRaiz} disabled={modoEdicao}>
              + Categoria
            </button>
            <button
              type="button"
              className={`btn-icone${modoEdicao ? ' categorias-modo-ativo' : ''}`}
              onClick={alternarModoEdicao}
              title={modoEdicao ? 'Sair do modo de edição' : 'Editar (arrastar/excluir)'}
              aria-label={modoEdicao ? 'Sair do modo de edição' : 'Entrar no modo de edição'}
            >
              <IconeSupabase arquivo="broomstick.svg" />
            </button>
            <button
              type="button"
              className="btn-icone"
              onClick={salvarAlteracoes}
              disabled={!modoEdicao || !temPendencias || salvando}
              title="Salvar alterações"
              aria-label="Salvar alterações"
            >
              <IconeSupabase arquivo="save.svg" />
            </button>
          </div>
        )}
      </div>

      {mostrarTagsItens ? (
        <TagsItensSecao />
      ) : (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
          <div className="categorias-conteudo">
            {raizes.length === 0 && <p className="categorias-vazio">Nenhum resultado.</p>}
            <SortableContext items={raizesTodas.map((r) => r.id)} strategy={rectSortingStrategy}>
              {raizes.map((raiz) => {
                const subs = subcategoriasDe(raiz.id);
                const totalSubs = dados.filter((c) => c.parent_id === raiz.id).length;
                const expandido = q ? true : !colapsados.has(raiz.id);
                const raizPendente = exclusoesPendentes.has(raiz.id);
                return (
                  <section key={raiz.id} className="categorias-secao">
                    <div className="categorias-raiz">
                      <ItemLinha
                        item={raiz}
                        nomeExibido={nomeAtual(raiz)}
                        renomeacaoPendente={renomeacoesPendentes.has(raiz.id)}
                        uso={uso?.get(raiz.id) ?? 0}
                        isRaiz
                        subCount={totalSubs}
                        expandido={expandido}
                        modoEdicao={modoEdicao}
                        pendente={raizPendente}
                        editando={edicaoAtivaId === raiz.id}
                        rascunho={rascunho}
                        onNomeClick={() => (modoEdicao ? iniciarEdicao(raiz) : alternarExpandir(raiz.id))}
                        onRascunhoChange={setRascunho}
                        onConfirmarEdicao={() => confirmarEdicao(raiz)}
                        onCancelarEdicao={cancelarEdicao}
                        onMarcarExclusao={() => marcarExclusao(raiz)}
                        onDesfazerExclusao={() => desfazerExclusao(raiz)}
                        onAdicionarSubcategoria={() => adicionarSubcategoria(raiz)}
                      />
                    </div>
                    {expandido &&
                      (subs.length === 0 ? (
                        <p className="categorias-vazio categorias-vazio-sub">Nenhuma subcategoria ainda.</p>
                      ) : (
                        <SortableContext items={subs.map((s) => s.id)} strategy={rectSortingStrategy}>
                          <div className="categorias-grid">
                            {subs.map((sub) => (
                              <ItemLinha
                                key={sub.id}
                                item={sub}
                                nomeExibido={nomeAtual(sub)}
                                renomeacaoPendente={renomeacoesPendentes.has(sub.id)}
                                uso={uso?.get(sub.id) ?? 0}
                                isRaiz={false}
                                modoEdicao={modoEdicao}
                                pendente={exclusoesPendentes.has(sub.id)}
                                editando={edicaoAtivaId === sub.id}
                                rascunho={rascunho}
                                onNomeClick={() => modoEdicao && iniciarEdicao(sub)}
                                onRascunhoChange={setRascunho}
                                onConfirmarEdicao={() => confirmarEdicao(sub)}
                                onCancelarEdicao={cancelarEdicao}
                                onMarcarExclusao={() => marcarExclusao(sub)}
                                onDesfazerExclusao={() => desfazerExclusao(sub)}
                              />
                            ))}
                          </div>
                        </SortableContext>
                      ))}
                  </section>
                );
              })}
            </SortableContext>
          </div>
        </DndContext>
      )}
    </div>
  );
}
