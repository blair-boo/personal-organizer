import { useState, type KeyboardEvent } from 'react';
import { useDialogos } from '../../components/Dialogo';
import { useToast } from '../../components/Toast';
import { mensagemDeErro } from '../../lib/erros';
import {
  useCategorias,
  useCriarCategoria,
  useExcluirCategoria,
  useRenomearCategoria,
  useUsoCategorias,
} from '../../hooks/useCategorias';
import type { Categoria, TipoCategoria } from '../../types';

function Secao({
  titulo,
  itens,
  busca,
  uso,
  paiPorId,
  edicaoAtivaId,
  rascunho,
  onIniciarEdicao,
  onRascunhoChange,
  onConfirmarEdicao,
  onCancelarEdicao,
  onExcluir,
  onAdicionarSubcategoria,
  onAdicionarRaiz,
}: {
  titulo: string;
  itens: Categoria[];
  busca: string;
  uso: Map<string, number> | undefined;
  paiPorId: Map<string, Categoria>;
  edicaoAtivaId: string | null;
  rascunho: string;
  onIniciarEdicao: (item: Categoria) => void;
  onRascunhoChange: (valor: string) => void;
  onConfirmarEdicao: (item: Categoria) => void;
  onCancelarEdicao: () => void;
  onExcluir: (item: Categoria) => void;
  onAdicionarSubcategoria?: (raiz: Categoria) => void;
  onAdicionarRaiz?: () => void;
}) {
  const q = busca.trim().toLowerCase();
  const visiveis = itens
    .filter((item) => !q || item.nome.toLowerCase().includes(q))
    .sort((a, b) => a.nome.localeCompare(b.nome));

  function handleKeyDown(e: KeyboardEvent<HTMLInputElement>, item: Categoria) {
    if (e.key === 'Enter') {
      e.preventDefault();
      onConfirmarEdicao(item);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      onCancelarEdicao();
    }
  }

  return (
    <section className="categorias-secao">
      <h2>
        {titulo} <span className="categorias-secao-contagem">({itens.length})</span>
        {onAdicionarRaiz && (
          <button type="button" className="btn-icone categorias-add" onClick={onAdicionarRaiz} aria-label={`Nova ${titulo.toLowerCase()}`}>
            +
          </button>
        )}
      </h2>

      {visiveis.length === 0 ? (
        <p className="categorias-vazio">{itens.length === 0 ? 'Nada aqui ainda.' : 'Nenhum resultado.'}</p>
      ) : (
        <div className="categorias-grid">
          {visiveis.map((item) => {
            const editando = edicaoAtivaId === item.id;
            const usoCount = uso?.get(item.id) ?? 0;
            const pai = item.parent_id ? paiPorId.get(item.parent_id) : null;

            if (editando) {
              return (
                <div key={item.id} className="categorias-item categorias-item-editando">
                  <input
                    value={rascunho}
                    onChange={(e) => onRascunhoChange(e.target.value)}
                    onKeyDown={(e) => handleKeyDown(e, item)}
                    autoFocus
                    aria-label={`Renomear ${item.nome}`}
                  />
                  <button type="button" className="btn-icone" onClick={() => onConfirmarEdicao(item)} title="Confirmar" aria-label="Confirmar">
                    ✓
                  </button>
                  <button type="button" className="btn-icone" onClick={onCancelarEdicao} title="Cancelar" aria-label="Cancelar">
                    ×
                  </button>
                </div>
              );
            }

            return (
              <div key={item.id} className="categorias-item">
                <button type="button" className="categorias-nome" onClick={() => onIniciarEdicao(item)}>
                  {item.nome}
                </button>
                {pai && <span className="categorias-pai">{pai.nome}</span>}
                {usoCount > 0 && (
                  <span className="categorias-uso" title={`Usada em ${usoCount} lançamento(s)`}>
                    {usoCount}
                  </span>
                )}
                {onAdicionarSubcategoria && (
                  <button
                    type="button"
                    className="btn-icone"
                    onClick={() => onAdicionarSubcategoria(item)}
                    title={`Nova subcategoria em ${item.nome}`}
                    aria-label={`Nova subcategoria em ${item.nome}`}
                  >
                    +
                  </button>
                )}
                <button
                  type="button"
                  className="btn-icone btn-icone-perigo"
                  onClick={() => onExcluir(item)}
                  title={`Excluir ${item.nome}`}
                  aria-label={`Excluir ${item.nome}`}
                >
                  ×
                </button>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}

export function CategoriasPage() {
  const [tipo, setTipo] = useState<TipoCategoria>('despesa');
  const { data: categorias } = useCategorias(tipo);
  const { data: uso } = useUsoCategorias();
  const criar = useCriarCategoria(tipo);
  const renomear = useRenomearCategoria(tipo);
  const excluir = useExcluirCategoria(tipo);
  const { confirmar, pedirTexto } = useDialogos();
  const { mostrarToast } = useToast();

  const [busca, setBusca] = useState('');
  const [edicaoAtivaId, setEdicaoAtivaId] = useState<string | null>(null);
  const [rascunho, setRascunho] = useState('');

  const raizes = (categorias ?? []).filter((c) => !c.parent_id);
  const subcategorias = (categorias ?? []).filter((c) => c.parent_id);
  const paiPorId = new Map((categorias ?? []).map((c) => [c.id, c]));

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
    const temFilhos = !item.parent_id && subcategorias.some((s) => s.parent_id === item.id);
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

  return (
    <div className="categorias-pagina">
      <div className="categorias-topo">
        <div className="categorias-cabecalho">
          <h1>Categorias</h1>
          <p className="categorias-subtitulo">Renomeie ou exclua categorias — a mudança também some dos lançamentos que usam.</p>
        </div>

        <nav className="app-nav categorias-abas">
          <button type="button" className={tipo === 'despesa' ? 'active' : ''} onClick={() => setTipo('despesa')}>
            Despesas
          </button>
          <button type="button" className={tipo === 'receita' ? 'active' : ''} onClick={() => setTipo('receita')}>
            Receitas
          </button>
        </nav>

        <input
          type="search"
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          placeholder="Buscar categorias…"
          className="categorias-busca"
          aria-label="Buscar categorias"
        />
      </div>

      <div className="categorias-conteudo">
        <Secao
          titulo="Categoria"
          itens={raizes}
          busca={busca}
          uso={uso}
          paiPorId={paiPorId}
          edicaoAtivaId={edicaoAtivaId}
          rascunho={rascunho}
          onIniciarEdicao={iniciarEdicao}
          onRascunhoChange={setRascunho}
          onConfirmarEdicao={confirmarEdicao}
          onCancelarEdicao={cancelarEdicao}
          onExcluir={excluirItem}
          onAdicionarSubcategoria={adicionarSubcategoria}
          onAdicionarRaiz={adicionarRaiz}
        />
        <Secao
          titulo="Subcategoria"
          itens={subcategorias}
          busca={busca}
          uso={uso}
          paiPorId={paiPorId}
          edicaoAtivaId={edicaoAtivaId}
          rascunho={rascunho}
          onIniciarEdicao={iniciarEdicao}
          onRascunhoChange={setRascunho}
          onConfirmarEdicao={confirmarEdicao}
          onCancelarEdicao={cancelarEdicao}
          onExcluir={excluirItem}
        />
      </div>
    </div>
  );
}
