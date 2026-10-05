import { useRef, useState, type ChangeEvent, type KeyboardEvent, type ReactNode } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { DndContext, PointerSensor, closestCenter, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core';
import { SortableContext, arrayMove, rectSortingStrategy, useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { useDialogos } from '../../components/Dialogo';
import { useToast } from '../../components/Toast';
import { IconeChevron } from '../../components/IconesProvisorios';
import { IconeDoUso, IconeFuncao } from '../../components/IconeUso';
import { ModalIcone } from '../../components/ModalIcone';
import { ModalUsosIcone } from '../../components/ModalUsosIcone';
import { SeletorCor } from '../../components/SeletorCor';
import { mensagemDeErro } from '../../lib/erros';
import { FUNCOES_ICONE, usoPadraoDaFuncao, type DefinicaoFuncao } from '../../lib/iconesFuncoes';
import { arquivosEmUso, caminhoDoUso, contarUsos, resolverUso } from '../../lib/iconesUsos';
import { caminhoIcone } from '../../lib/storage';
import { useAdicionarIcones, useExcluirIcone, useIconesGaleria, useRenomearIcone, useReordenarIcones } from '../../hooks/useIcones';
import { useIconesUsos, useRemoverUsoIcone, useSalvarUsoIcone } from '../../hooks/useIconesUsos';
import { useTemaEfetivo } from '../../hooks/useTema';
import type { IconeArquivo, UsoIcone } from '../../types';

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
 * Aba de ícones (Settings): ícones de função e de UI em uso no app, mais os
 * arquivos livres do bucket `icones` (raiz = com máscara, PNG/ = originais) com
 * adicionar, renomear, reordenar e excluir, além da prévia de fonte/ícones em qualquer tamanho.
 */
export function IconesPage() {
  const [tamanho, setTamanho] = useState(TAMANHO_PADRAO);
  const [aplicarFonte, setAplicarFonte] = useState(true);
  const [aplicarIcones, setAplicarIcones] = useState(true);
  const { data: usos = [] } = useIconesUsos();
  const emUso = arquivosEmUso(usos);
  const tamanhoFonte = aplicarFonte ? tamanho : TAMANHO_PADRAO;
  const tamanhoIcones = aplicarIcones ? tamanho : TAMANHO_PADRAO;
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
          <div className="testes-tamanho-alvos" role="group" aria-label="Onde aplicar o tamanho">
            <label>
              <input type="checkbox" checked={aplicarFonte} onChange={(e) => setAplicarFonte(e.target.checked)} />
              Fonte
            </label>
            <label>
              <input type="checkbox" checked={aplicarIcones} onChange={(e) => setAplicarIcones(e.target.checked)} />
              Ícones
            </label>
          </div>
        </div>

        <section className="testes-secao testes-secao-cor">
          <h2>Cor do ícone</h2>
          <SeletorCor onCorChange={aplicarCor} />
        </section>
      </div>

      <div className="testes-conteudo" ref={conteudoRef}>
        <section className="testes-secao">
          <h2>Fonte: {tamanhoFonte}px</h2>
          <div className="testes-fonte-amostra" style={{ fontSize: tamanhoFonte }}>
            <p>Regular — O rato roeu a roupa do rei de Roma.</p>
            <p style={{ fontWeight: 600 }}>Negrito (600) — O rato roeu a roupa do rei de Roma.</p>
            <p style={{ fontStyle: 'italic' }}>Itálico — O rato roeu a roupa do rei de Roma.</p>
            <p className="testes-fonte-muted">Discreto (opacidade 0,7) — dicas e legendas.</p>
          </div>
        </section>

        <SecaoRecolhivel titulo="Ícones (Settings)">
          <ListaIconesSettings tamanho={tamanhoIcones} usos={usos} />
        </SecaoRecolhivel>
        <SecaoRecolhivel titulo="Ícones (UI)">
          <ListaIconesUi tamanho={tamanhoIcones} usos={usos} />
        </SecaoRecolhivel>
        <SecaoIcones pasta="" titulo="Ícones (Com máscara)" tamanho={tamanhoIcones} emUso={emUso} />
        <SecaoIcones pasta="PNG" titulo="Ícones (Originais)" tamanho={tamanhoIcones} emUso={emUso} />
      </div>
    </div>
  );
}

/** Seção que começa recolhida e só mostra o conteúdo ao clicar no título. */
function SecaoRecolhivel({ titulo, children }: { titulo: string; children: ReactNode }) {
  const [aberta, setAberta] = useState(false);
  return (
    <section className="testes-secao">
      <button type="button" className="icones-secao-titulo" onClick={() => setAberta((v) => !v)} aria-expanded={aberta}>
        <IconeChevron aberto={aberta} />
        {titulo}
      </button>
      {aberta && children}
    </section>
  );
}

/** Ícones com função (salvar, editar...): trocar aqui muda em todo o app. */
function ListaIconesSettings({ tamanho, usos }: { tamanho: number; usos: UsoIcone[] }) {
  const tema = useTemaEfetivo();
  const salvar = useSalvarUsoIcone();
  const remover = useRemoverUsoIcone();
  const { mostrarToast } = useToast();
  const [alvo, setAlvo] = useState<DefinicaoFuncao | null>(null);

  function usoAtual(def: DefinicaoFuncao): UsoIcone | null {
    return resolverUso(usos, 'funcao', def.chave, tema) ?? usoPadraoDaFuncao(def.chave);
  }

  async function aoConfirmar(uso: UsoIcone) {
    try {
      await salvar.mutateAsync(uso);
      mostrarToast('Ícone da função atualizado em todo o app.');
      setAlvo(null);
    } catch (err) {
      mostrarToast(mensagemDeErro(err), 'erro');
    }
  }

  async function restaurar(def: DefinicaoFuncao) {
    try {
      await remover.mutateAsync({ alvoTipo: 'funcao', alvoId: def.chave });
      mostrarToast('Ícone padrão restaurado.');
    } catch (err) {
      mostrarToast(mensagemDeErro(err), 'erro');
    }
  }

  return (
    <>
      <p className="testes-legenda">Trocar o ícone de uma função altera todos os lugares em que ela aparece. O nome aparece ao passar o mouse.</p>
      <ul className="icones-lista">
        {FUNCOES_ICONE.map((def) => {
          const personalizado = usos.some((u) => u.alvo_tipo === 'funcao' && u.alvo_id === def.chave);
          return (
            <li key={def.chave} className="icones-lista-item">
              <button type="button" className="btn-icone icone-uso-botao" onClick={() => setAlvo(def)} title={`Trocar o ícone de ${def.rotulo}`} aria-label={`Trocar o ícone de ${def.rotulo}`}>
                <IconeFuncao funcao={def.chave} tamanho={tamanho} />
              </button>
              <span className="icones-lista-rotulo">{def.rotulo}</span>
              {personalizado && (
                <button type="button" className="icones-restaurar" onClick={() => void restaurar(def)} title={`Restaurar o ícone padrão de ${def.rotulo}`}>
                  Restaurar
                </button>
              )}
            </li>
          );
        })}
      </ul>
      {alvo && (
        <ModalIcone
          aberto
          rotuloAlvo={alvo.rotulo}
          alvoTipo="funcao"
          alvoId={alvo.chave}
          inicial={usoAtual(alvo)}
          tamanhoBase={16}
          permiteRemover={false}
          onConfirmar={(uso) => void aoConfirmar(uso)}
          onFechar={() => setAlvo(null)}
        />
      )}
    </>
  );
}

/** Ícones que ilustram títulos (categorias e abas). Clicar abre onde cada um é usado. */
function ListaIconesUi({ tamanho, usos }: { tamanho: number; usos: UsoIcone[] }) {
  const [caminhoAberto, setCaminhoAberto] = useState<string | null>(null);
  const instancias = usos.filter((u) => u.alvo_tipo !== 'funcao');
  const porCaminho = new Map<string, UsoIcone[]>();
  for (const u of instancias) {
    const lista = porCaminho.get(caminhoDoUso(u)) ?? [];
    lista.push(u);
    porCaminho.set(caminhoDoUso(u), lista);
  }

  return (
    <>
      {porCaminho.size === 0 ? (
        <p className="hierarquia-vazio">Nenhum ícone em uso nos títulos ainda.</p>
      ) : (
        <ul className="icones-lista">
          {[...porCaminho.entries()].map(([caminho, lista]) => (
            <li key={caminho} className="icones-lista-item">
              <button type="button" className="btn-icone icone-uso-botao" onClick={() => setCaminhoAberto(caminho)} title={`Ver onde ${caminho} é usado`} aria-label={`Ver onde ${caminho} é usado`}>
                <IconeDoUso uso={lista[0]} tamanhoBase={tamanho} />
              </button>
              <span className="icones-lista-rotulo">{caminho.split('/').pop()}</span>
              <span className="icones-contagem">{contarUsos(usos, caminho)} uso(s)</span>
            </li>
          ))}
        </ul>
      )}
      {caminhoAberto && (
        <ModalUsosIcone usos={porCaminho.get(caminhoAberto) ?? []} tamanho={tamanho} onFechar={() => setCaminhoAberto(null)} />
      )}
    </>
  );
}

function SecaoIcones({ pasta, titulo, tamanho, emUso }: { pasta: string; titulo: string; tamanho: number; emUso: Set<string> }) {
  const { data, isLoading, isError, error } = useIconesGaleria(pasta);
  const adicionar = useAdicionarIcones(pasta);
  const renomear = useRenomearIcone(pasta);
  const excluir = useExcluirIcone(pasta);
  const reordenar = useReordenarIcones(pasta);
  const { confirmar } = useDialogos();
  const { mostrarToast } = useToast();
  const qc = useQueryClient();
  const [atualizando, setAtualizando] = useState(false);

  const [modoEdicao, setModoEdicao] = useState(false);
  const [ordemLocal, setOrdemLocal] = useState<IconeArquivo[] | null>(null);
  const [exclusoesPendentes, setExclusoesPendentes] = useState<Set<string>>(new Set());
  const [renomeacoesPendentes, setRenomeacoesPendentes] = useState<Map<string, string>>(new Map());
  const [edicaoAtivaId, setEdicaoAtivaId] = useState<string | null>(null);
  const [rascunho, setRascunho] = useState('');
  const [salvando, setSalvando] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  // Ícones em uso (funções, títulos, placeholder) saem daqui e aparecem em Settings ou UI.
  const livres = (lista: IconeArquivo[]) => lista.filter((i) => !emUso.has(caminhoIcone(pasta, i.nome)));
  const dados = livres(ordemLocal ?? data ?? []);
  const temPendencias = ordemLocal !== null || exclusoesPendentes.size > 0 || renomeacoesPendentes.size > 0;
  const erro = isError ? mensagemDeErro(error) : null;

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
    try {
      await adicionar.mutateAsync(arquivos);
      mostrarToast(arquivos.length === 1 ? 'Ícone adicionado.' : `${arquivos.length} ícones adicionados.`);
    } catch (err) {
      mostrarToast(mensagemDeErro(err), 'erro');
    }
  }

  async function atualizar() {
    setAtualizando(true);
    try {
      await Promise.all([qc.invalidateQueries({ queryKey: ['icones_galeria'] }), qc.invalidateQueries({ queryKey: ['icones_usos'] })]);
      mostrarToast('Ícones atualizados.');
    } catch (err) {
      mostrarToast(mensagemDeErro(err), 'erro');
    } finally {
      setAtualizando(false);
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
          {titulo}: {tamanho}px
        </h2>
        <div className="testes-secao-acoes">
          <input
            ref={inputRef}
            type="file"
            multiple
            accept="image/*"
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
            <IconeFuncao funcao="adicionar" />
          </button>
          <button
            type="button"
            className="btn-icone"
            onClick={() => void atualizar()}
            disabled={atualizando}
            title="Atualizar lista de ícones"
            aria-label="Atualizar lista de ícones"
          >
            <IconeFuncao funcao="atualizar" />
          </button>
          <button
            type="button"
            className={`btn-icone${modoEdicao ? ' categorias-modo-ativo' : ''}`}
            onClick={alternarModoEdicao}
            title={modoEdicao ? 'Sair do modo de edição' : 'Editar (arrastar/renomear/excluir)'}
            aria-label={modoEdicao ? 'Sair do modo de edição' : 'Entrar no modo de edição'}
          >
            <IconeFuncao funcao="editar" />
          </button>
          <button
            type="button"
            className="btn-icone"
            onClick={salvarAlteracoes}
            disabled={!modoEdicao || !temPendencias || salvando}
            title="Salvar alterações"
            aria-label="Salvar alterações"
          >
            <IconeFuncao funcao="salvar" />
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

      <p className="testes-legenda">Ícones em uso aparecem em Ícones (Settings) ou Ícones (UI) e não podem ser renomeados nem excluídos daqui.</p>
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

      {modoEdicao && (
        <button
          type="button"
          className={`testes-icone-excluir${pendenteExclusao ? ' testes-icone-excluir-marcado' : ''}`}
          onClick={onAlternarExclusao}
          title={pendenteExclusao ? 'Desfazer exclusão' : 'Excluir'}
          aria-label={pendenteExclusao ? `Desfazer exclusão de ${icone.nome}` : `Excluir ${icone.nome}`}
        >
          <IconeFuncao funcao="fechar" tamanho={10} />
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
              <IconeFuncao funcao="confirmar" tamanho={14} />
            </button>
            <button type="button" className="btn-icone" onClick={onCancelarEdicao} title="Cancelar" aria-label="Cancelar">
              <IconeFuncao funcao="fechar" tamanho={14} />
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          className={`testes-icone-nome${pendenteExclusao ? ' testes-icone-nome-riscado' : ''}`}
          onClick={onIniciarEdicao}
          disabled={!modoEdicao || pendenteExclusao}
        >
          {nomeExibido}
        </button>
      )}
    </div>
  );
}
