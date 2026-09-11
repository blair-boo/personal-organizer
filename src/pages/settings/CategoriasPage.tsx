import { useState, type KeyboardEvent } from 'react';
import { DndContext, PointerSensor, closestCenter, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core';
import { SortableContext, arrayMove, rectSortingStrategy, useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { useDialogos } from '../../components/Dialogo';
import { useToast } from '../../components/Toast';
import { IconeSupabase } from '../../components/IconeSupabase';
import { mensagemDeErro } from '../../lib/erros';
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
  uso,
  bloqueado,
  editando,
  rascunho,
  onIniciarEdicao,
  onRascunhoChange,
  onConfirmarEdicao,
  onCancelarEdicao,
  onExcluir,
  onAdicionarSubcategoria,
}: {
  item: Categoria;
  uso: number;
  bloqueado: boolean;
  editando: boolean;
  rascunho: string;
  onIniciarEdicao: () => void;
  onRascunhoChange: (v: string) => void;
  onConfirmarEdicao: () => void;
  onCancelarEdicao: () => void;
  onExcluir: () => void;
  onAdicionarSubcategoria?: () => void;
}) {
  const sortable = useSortable({ id: item.id });
  const style = { transform: CSS.Transform.toString(sortable.transform), transition: sortable.transition };

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
        <input value={rascunho} onChange={(e) => onRascunhoChange(e.target.value)} onKeyDown={handleKeyDown} autoFocus aria-label={`Renomear ${item.nome}`} />
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
    <div ref={sortable.setNodeRef} style={style} className="categorias-item">
      <button type="button" className="btn-icone categorias-arrastar" aria-label={`Arrastar ${item.nome}`} {...sortable.attributes} {...sortable.listeners}>
        <IconeGrip />
      </button>
      <button type="button" className="categorias-nome" onClick={onIniciarEdicao} disabled={bloqueado}>
        {item.nome}
      </button>
      {uso > 0 && (
        <span className="categorias-uso" title={`Usada em ${uso} lançamento(s)`}>
          {uso}
        </span>
      )}
      {onAdicionarSubcategoria && (
        <button type="button" className="btn-icone" onClick={onAdicionarSubcategoria} disabled={bloqueado} title={`Nova subcategoria em ${item.nome}`} aria-label={`Nova subcategoria em ${item.nome}`}>
          +
        </button>
      )}
      <button type="button" className="btn-icone btn-icone-perigo" onClick={onExcluir} disabled={bloqueado} title={`Excluir ${item.nome}`} aria-label={`Excluir ${item.nome}`}>
        <IconeSupabase arquivo="trash3.svg" />
      </button>
    </div>
  );
}

export function CategoriasPage() {
  const [tipo, setTipo] = useState<TipoCategoria>('despesa');
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
  const [ordemLocal, setOrdemLocal] = useState<Categoria[] | null>(null);
  const [salvandoOrdem, setSalvandoOrdem] = useState(false);
  const haAlteracoesOrdem = ordemLocal !== null;

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
    setRascunho(item.nome);
  }

  function cancelarEdicao() {
    setEdicaoAtivaId(null);
    setRascunho('');
  }

  async function confirmarEdicao(item: Categoria) {
    const novo = rascunho.trim();
    cancelarEdicao();
    if (!novo || novo === item.nome) return;
    try {
      await renomear.mutateAsync({ id: item.id, nome: novo });
    } catch (err) {
      mostrarToast(mensagemDeErro(err), 'erro');
    }
  }

  async function excluirItem(item: Categoria) {
    const usoCount = uso?.get(item.id) ?? 0;
    const temFilhos = !item.parent_id && dados.some((s) => s.parent_id === item.id);
    const avisos = [
      usoCount > 0 ? `Usada em ${usoCount} lançamento(s) — eles ficam sem categoria.` : null,
      temFilhos ? 'Isso também exclui as subcategorias dela.' : null,
    ].filter(Boolean);
    const ok = await confirmar({
      titulo: `Excluir "${item.nome}"?`,
      mensagem: avisos.length > 0 ? avisos.join(' ') : 'Essa ação não pode ser desfeita.',
      confirmarRotulo: 'Excluir',
      perigoso: true,
    });
    if (!ok) return;
    try {
      await excluir.mutateAsync(item.id);
    } catch (err) {
      mostrarToast(mensagemDeErro(err), 'erro');
    }
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

  function descartarOrdem() {
    setOrdemLocal(null);
  }

  async function salvarOrdem() {
    if (!ordemLocal) return;
    setSalvandoOrdem(true);
    try {
      await reordenar.mutateAsync(ordemLocal.map((c) => ({ id: c.id, ordem: c.ordem })));
      mostrarToast('Ordem salva.');
      setOrdemLocal(null);
    } catch (err) {
      mostrarToast(mensagemDeErro(err), 'erro');
    } finally {
      setSalvandoOrdem(false);
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
          <p className="categorias-subtitulo">Renomeie, exclua ou arraste pra reordenar — a mudança de nome/exclusão já salva na hora; a ordem só depois de confirmar.</p>
        </div>

        <nav className="app-nav categorias-abas">
          <button type="button" className={tipo === 'despesa' ? 'active' : ''} onClick={() => setTipo('despesa')} disabled={haAlteracoesOrdem}>
            Despesas
          </button>
          <button type="button" className={tipo === 'receita' ? 'active' : ''} onClick={() => setTipo('receita')} disabled={haAlteracoesOrdem}>
            Receitas
          </button>
        </nav>

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
          <button type="button" className="btn-icone" onClick={descartarOrdem} disabled={!haAlteracoesOrdem} title="Descartar reordenação" aria-label="Descartar reordenação">
            <IconeSupabase arquivo="broomstick.svg" />
          </button>
          <button type="button" className="btn-icone" onClick={salvarOrdem} disabled={!haAlteracoesOrdem || salvandoOrdem} title="Salvar ordem" aria-label="Salvar ordem">
            <IconeSupabase arquivo="save.svg" />
          </button>
          {!haAlteracoesOrdem && (
            <button type="button" onClick={adicionarRaiz}>
              + Categoria
            </button>
          )}
        </div>
      </div>

      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
        <div className="categorias-conteudo">
          {raizes.length === 0 && <p className="categorias-vazio">Nenhum resultado.</p>}
          <SortableContext items={raizesTodas.map((r) => r.id)} strategy={rectSortingStrategy}>
            {raizes.map((raiz) => {
              const subs = subcategoriasDe(raiz.id);
              return (
                <section key={raiz.id} className="categorias-secao">
                  <div className="categorias-raiz">
                    <ItemLinha
                      item={raiz}
                      uso={uso?.get(raiz.id) ?? 0}
                      bloqueado={haAlteracoesOrdem}
                      editando={edicaoAtivaId === raiz.id}
                      rascunho={rascunho}
                      onIniciarEdicao={() => iniciarEdicao(raiz)}
                      onRascunhoChange={setRascunho}
                      onConfirmarEdicao={() => confirmarEdicao(raiz)}
                      onCancelarEdicao={cancelarEdicao}
                      onExcluir={() => excluirItem(raiz)}
                      onAdicionarSubcategoria={() => adicionarSubcategoria(raiz)}
                    />
                  </div>
                  {subs.length === 0 ? (
                    <p className="categorias-vazio categorias-vazio-sub">Nenhuma subcategoria ainda.</p>
                  ) : (
                    <SortableContext items={subs.map((s) => s.id)} strategy={rectSortingStrategy}>
                      <div className="categorias-grid">
                        {subs.map((sub) => (
                          <ItemLinha
                            key={sub.id}
                            item={sub}
                            uso={uso?.get(sub.id) ?? 0}
                            bloqueado={haAlteracoesOrdem}
                            editando={edicaoAtivaId === sub.id}
                            rascunho={rascunho}
                            onIniciarEdicao={() => iniciarEdicao(sub)}
                            onRascunhoChange={setRascunho}
                            onConfirmarEdicao={() => confirmarEdicao(sub)}
                            onCancelarEdicao={cancelarEdicao}
                            onExcluir={() => excluirItem(sub)}
                          />
                        ))}
                      </div>
                    </SortableContext>
                  )}
                </section>
              );
            })}
          </SortableContext>
        </div>
      </DndContext>
    </div>
  );
}
