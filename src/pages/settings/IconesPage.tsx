import { useRef, useState, type ChangeEvent, type KeyboardEvent } from 'react';
import { DndContext, PointerSensor, closestCenter, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core';
import { SortableContext, arrayMove, rectSortingStrategy, useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { useDialogos } from '../../components/Dialogo';
import { useToast } from '../../components/Toast';
import { IconeSupabase } from '../../components/IconeSupabase';
import { SeletorCor } from '../../components/SeletorCor';
import { mensagemDeErro } from '../../lib/erros';
import { useAdicionarIcones, useExcluirIcone, useIconesGaleria, useRenomearIcone, useReordenarIcones } from '../../hooks/useIcones';
import type { IconeArquivo } from '../../types';

const TAMANHO_PADRAO = 16;
const TAMANHO_MIN = 10;
const TAMANHO_MAX = 64;

function extensaoDe(nome: string): string {
  const i = nome.lastIndexOf('.');
  return i >= 0 ? nome.slice(i + 1) : '';
}

function baseDe(nome: string): string {
  const i = nome.lastIndexOf('.');
  return i >= 0 ? nome.slice(0, i) : nome;
}

/**
 * Aba de ícones (Settings): gerencia os arquivos do bucket `icones` (SVG na
 * raiz, PNG na pasta PNG/) — adicionar, renomear, reordenar e excluir — além
 * da prévia de fonte/ícones em qualquer tamanho.
 */
export function IconesPage() {
  const [tamanho, setTamanho] = useState(TAMANHO_PADRAO);
  const conteudoRef = useRef<HTMLDivElement>(null);

  function aplicarCor(hex: string) {
    conteudoRef.current?.style.setProperty('--testes-cor-preview', hex);
  }

  function ajustarTamanho(valor: number) {
    if (Number.isNaN(valor)) return;
    setTamanho(Math.min(TAMANHO_MAX, Math.max(TAMANHO_MIN, valor)));
  }

  return (
    <div className="testes-pagina">
      <div className="testes-topo">
        <div className="testes-cabecalho">
          <h1>Ícones</h1>
          <p className="testes-subtitulo">
            Prévia de fonte e ícones em qualquer tamanho, e gerenciamento dos arquivos do bucket `icones`.
          </p>
        </div>

        <div className="testes-controle-tamanho">
          <label className="testes-tamanho-label">
            Tamanho
            <input
              type="range"
              min={TAMANHO_MIN}
              max={TAMANHO_MAX}
              value={tamanho}
              onChange={(e) => ajustarTamanho(Number(e.target.value))}
            />
            <input
              type="number"
              min={TAMANHO_MIN}
              max={TAMANHO_MAX}
              value={tamanho}
              onChange={(e) => ajustarTamanho(Number(e.target.value))}
              className="testes-tamanho-input"
            />
            px
          </label>
        </div>

        <section className="testes-secao testes-secao-cor">
          <h2>Cor do ícone</h2>
          <SeletorCor onCorChange={aplicarCor} />
        </section>
      </div>

      <div className="testes-conteudo" ref={conteudoRef}>
        <section className="testes-secao">
          <h2>Fonte — {tamanho}px</h2>
          <div className="testes-fonte-amostra" style={{ fontSize: tamanho }}>
            <p>Regular — O rato roeu a roupa do rei de Roma.</p>
            <p style={{ fontWeight: 600 }}>Negrito (600) — O rato roeu a roupa do rei de Roma.</p>
            <p style={{ fontStyle: 'italic' }}>Itálico — O rato roeu a roupa do rei de Roma.</p>
            <p className="testes-fonte-muted">Discreto (opacidade 0,7) — dicas e legendas.</p>
          </div>
        </section>

        <SecaoIcones pasta="" titulo="Ícones (SVG)" tamanho={tamanho} />
        <SecaoIcones pasta="PNG" titulo="Ícones (PNG)" tamanho={tamanho} />
      </div>
    </div>
  );
}

function SecaoIcones({ pasta, titulo, tamanho }: { pasta: string; titulo: string; tamanho: number }) {
  const { data, isLoading, isError, error } = useIconesGaleria(pasta);
  const adicionar = useAdicionarIcones(pasta);
  const renomear = useRenomearIcone(pasta);
  const excluir = useExcluirIcone(pasta);
  const reordenar = useReordenarIcones(pasta);
  const { confirmar } = useDialogos();
  const { mostrarToast } = useToast();

  const [modoEdicao, setModoEdicao] = useState(false);
  const [ordemLocal, setOrdemLocal] = useState<IconeArquivo[] | null>(null);
  const [exclusoesPendentes, setExclusoesPendentes] = useState<Set<string>>(new Set());
  const [renomeacoesPendentes, setRenomeacoesPendentes] = useState<Map<string, string>>(new Map());
  const [edicaoAtivaId, setEdicaoAtivaId] = useState<string | null>(null);
  const [rascunho, setRascunho] = useState('');
  const [salvando, setSalvando] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  const dados = ordemLocal ?? data ?? [];
  const temPendencias = ordemLocal !== null || exclusoesPendentes.size > 0 || renomeacoesPendentes.size > 0;
  const erro = isError ? mensagemDeErro(error) : null;
  const temProtegido = dados.some((i) => i.protegido);

  function nomeAtual(item: IconeArquivo): string {
    return renomeacoesPendentes.get(item.id) ?? item.nome;
  }

  function iniciarEdicao(item: IconeArquivo) {
    setEdicaoAtivaId(item.id);
    setRascunho(baseDe(nomeAtual(item)));
  }

  function cancelarEdicao() {
    setEdicaoAtivaId(null);
    setRascunho('');
  }

  function confirmarEdicao(item: IconeArquivo) {
    const baseNova = rascunho.trim();
    cancelarEdicao();
    if (!baseNova) return;
    const nomeNovo = `${baseNova}.${extensaoDe(item.nome)}`;
    if (nomeNovo === nomeAtual(item)) return;
    setRenomeacoesPendentes((atual) => {
      const novoMapa = new Map(atual);
      if (nomeNovo === item.nome) {
        novoMapa.delete(item.id);
      } else {
        novoMapa.set(item.id, nomeNovo);
      }
      return novoMapa;
    });
  }

  function alternarExclusao(item: IconeArquivo) {
    setExclusoesPendentes((atual) => {
      const novo = new Set(atual);
      if (novo.has(item.id)) novo.delete(item.id);
      else novo.add(item.id);
      return novo;
    });
  }

  function alternarModoEdicao() {
    if (modoEdicao) {
      setModoEdicao(false);
      setOrdemLocal(null);
      setExclusoesPendentes(new Set());
      setRenomeacoesPendentes(new Map());
      cancelarEdicao();
    } else {
      setModoEdicao(true);
    }
  }

  function onDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const base = ordemLocal ?? data ?? [];
    const oldIndex = base.findIndex((i) => i.id === active.id);
    const newIndex = base.findIndex((i) => i.id === over.id);
    if (oldIndex < 0 || newIndex < 0) return;
    setOrdemLocal(arrayMove(base, oldIndex, newIndex));
  }

  async function onArquivosEscolhidos(e: ChangeEvent<HTMLInputElement>) {
    const arquivos = Array.from(e.target.files ?? []);
    e.target.value = '';
    if (arquivos.length === 0) return;
    const extensaoEsperada = pasta === 'PNG' ? 'png' : 'svg';
    const validos = arquivos.filter((a) => extensaoDe(a.name).toLowerCase() === extensaoEsperada);
    if (validos.length < arquivos.length) {
      mostrarToast(`Só é possível enviar arquivos .${extensaoEsperada} aqui.`, 'erro');
    }
    if (validos.length === 0) return;
    try {
      await adicionar.mutateAsync(validos);
      mostrarToast(validos.length === 1 ? 'Ícone adicionado.' : `${validos.length} ícones adicionados.`);
    } catch (err) {
      mostrarToast(mensagemDeErro(err), 'erro');
    }
  }

  async function salvarAlteracoes() {
    if (!temPendencias) return;
    if (exclusoesPendentes.size > 0) {
      const ok = await confirmar({
        titulo: `Excluir ${exclusoesPendentes.size} ícone(s)?`,
        mensagem: 'Essa ação remove o arquivo do Supabase Storage e não pode ser desfeita.',
        confirmarRotulo: 'Excluir e salvar',
        perigoso: true,
      });
      if (!ok) return;
    }
    setSalvando(true);
    try {
      for (const [id, nomeNovo] of renomeacoesPendentes) {
        if (exclusoesPendentes.has(id)) continue;
        const item = (data ?? []).find((i) => i.id === id);
        if (!item) continue;
        await renomear.mutateAsync({ id, nomeAntigo: item.nome, nomeNovo });
      }
      for (const id of exclusoesPendentes) {
        const item = (data ?? []).find((i) => i.id === id);
        if (!item) continue;
        await excluir.mutateAsync({ id, nome: item.nome });
      }
      if (ordemLocal) {
        const sobreviventes = ordemLocal.filter((i) => !exclusoesPendentes.has(i.id));
        await reordenar.mutateAsync(sobreviventes.map((item, i) => ({ id: item.id, ordem: i + 1 })));
      }
      mostrarToast('Alterações salvas.');
      setModoEdicao(false);
      setOrdemLocal(null);
      setExclusoesPendentes(new Set());
      setRenomeacoesPendentes(new Map());
    } catch (err) {
      mostrarToast(mensagemDeErro(err), 'erro');
    } finally {
      setSalvando(false);
    }
  }

  return (
    <section className="testes-secao">
      <div className="testes-secao-cabecalho">
        <h2>
          {titulo} — {tamanho}px
        </h2>
        <div className="testes-secao-acoes">
          <input
            ref={inputRef}
            type="file"
            multiple
            accept={pasta === 'PNG' ? 'image/png' : 'image/svg+xml'}
            onChange={onArquivosEscolhidos}
            hidden
          />
          <button
            type="button"
            className="btn-icone"
            onClick={() => inputRef.current?.click()}
            title="Adicionar ícones"
            aria-label="Adicionar ícones"
          >
            <IconeMais />
          </button>
          <button
            type="button"
            className={`btn-icone${modoEdicao ? ' categorias-modo-ativo' : ''}`}
            onClick={alternarModoEdicao}
            title={modoEdicao ? 'Sair do modo de edição' : 'Editar (arrastar/renomear/excluir)'}
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
      </div>

      {erro && <p className="testes-erro">Não foi possível carregar os ícones: {erro}</p>}
      {!erro && !isLoading && dados.length === 0 && (
        <p className="hierarquia-vazio">Nenhum ícone encontrado {pasta ? `na pasta ${pasta}` : 'na raiz do bucket'}.</p>
      )}

      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
        <SortableContext items={dados.map((i) => i.id)} strategy={rectSortingStrategy}>
          <div className="testes-icones-grid">
            {dados.map((icone) => (
              <IconeItem
                key={icone.id}
                icone={icone}
                nomeExibido={nomeAtual(icone)}
                tamanho={tamanho}
                pastaSvg={pasta === ''}
                modoEdicao={modoEdicao}
                pendenteExclusao={exclusoesPendentes.has(icone.id)}
                editando={edicaoAtivaId === icone.id}
                rascunho={rascunho}
                onRascunhoChange={setRascunho}
                onIniciarEdicao={() => iniciarEdicao(icone)}
                onConfirmarEdicao={() => confirmarEdicao(icone)}
                onCancelarEdicao={cancelarEdicao}
                onAlternarExclusao={() => alternarExclusao(icone)}
              />
            ))}
          </div>
        </SortableContext>
      </DndContext>

      {temProtegido && (
        <p className="testes-legenda">* usado em outras telas do app — não pode ser renomeado nem excluído por aqui.</p>
      )}
    </section>
  );
}

function IconeItem({
  icone,
  nomeExibido,
  tamanho,
  pastaSvg,
  modoEdicao,
  pendenteExclusao,
  editando,
  rascunho,
  onRascunhoChange,
  onIniciarEdicao,
  onConfirmarEdicao,
  onCancelarEdicao,
  onAlternarExclusao,
}: {
  icone: IconeArquivo;
  nomeExibido: string;
  tamanho: number;
  pastaSvg: boolean;
  modoEdicao: boolean;
  pendenteExclusao: boolean;
  editando: boolean;
  rascunho: string;
  onRascunhoChange: (v: string) => void;
  onIniciarEdicao: () => void;
  onConfirmarEdicao: () => void;
  onCancelarEdicao: () => void;
  onAlternarExclusao: () => void;
}) {
  const sortable = useSortable({ id: icone.id });
  const style = { transform: CSS.Transform.toString(sortable.transform), transition: sortable.transition };

  function onKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') {
      e.preventDefault();
      onConfirmarEdicao();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      onCancelarEdicao();
    }
  }

  return (
    <div ref={sortable.setNodeRef} style={style} className={`testes-icone-item${pendenteExclusao ? ' testes-icone-item-pendente' : ''}`}>
      {/* Arraste só a partir da miniatura (não do nome): sem alça de 3 traços, como pedido. */}
      <div className="testes-icone-arrastar" aria-label={`Arrastar ${icone.nome}`} {...sortable.attributes} {...sortable.listeners}>
        {pastaSvg ? (
          <span
            className="testes-icone-svg"
            role="img"
            aria-label={icone.nome}
            style={{
              width: tamanho,
              height: tamanho,
              WebkitMaskImage: `url(${icone.url})`,
              maskImage: `url(${icone.url})`,
            }}
          />
        ) : (
          <img
            className="testes-icone-img"
            src={icone.url}
            alt={icone.nome}
            width={tamanho}
            height={tamanho}
            style={{ width: tamanho, height: tamanho }}
            loading="lazy"
          />
        )}
      </div>

      {modoEdicao && !icone.protegido && (
        <button
          type="button"
          className={`testes-icone-excluir${pendenteExclusao ? ' testes-icone-excluir-marcado' : ''}`}
          onClick={onAlternarExclusao}
          title={pendenteExclusao ? 'Desfazer exclusão' : 'Excluir'}
          aria-label={pendenteExclusao ? `Desfazer exclusão de ${icone.nome}` : `Excluir ${icone.nome}`}
        >
          ×
        </button>
      )}

      {editando ? (
        <div className="testes-icone-editando">
          <div className="testes-icone-editando-linha">
            <input
              className="testes-icone-nome-input"
              value={rascunho}
              onChange={(e) => onRascunhoChange(e.target.value)}
              onKeyDown={onKeyDown}
              autoFocus
              aria-label={`Renomear ${icone.nome}`}
            />
            <span className="testes-icone-extensao">.{extensaoDe(icone.nome)}</span>
          </div>
          <div className="testes-icone-editando-acoes">
            <button type="button" className="btn-icone" onClick={onConfirmarEdicao} title="Confirmar" aria-label="Confirmar">
              ✓
            </button>
            <button type="button" className="btn-icone" onClick={onCancelarEdicao} title="Cancelar" aria-label="Cancelar">
              ×
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          className={`testes-icone-nome${pendenteExclusao ? ' testes-icone-nome-riscado' : ''}`}
          onClick={onIniciarEdicao}
          disabled={!modoEdicao || icone.protegido || pendenteExclusao}
        >
          {nomeExibido}
          {icone.protegido && ' *'}
        </button>
      )}
    </div>
  );
}

/** Adicionar ícones — SVG desenhado inline, sem depender de arquivo no bucket. */
function IconeMais() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M12 5v14" />
      <path d="M5 12h14" />
    </svg>
  );
}
