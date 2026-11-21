import { useMemo, useState, type KeyboardEvent } from 'react';
import {
  DndContext,
  PointerSensor,
  closestCenter,
  useDroppable,
  useSensor,
  useSensors,
  type CollisionDetection,
  type DragEndEvent,
  type DragOverEvent,
} from '@dnd-kit/core';
import { SortableContext, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { ModalBase } from '../../components/ModalBase';
import { IconeFuncao } from '../../components/IconeUso';
import { IconeCamera, IconeQr } from '../../components/IconesProvisorios';
import { useDialogos } from '../../components/Dialogo';
import { useToast } from '../../components/Toast';
import { mensagemDeErro } from '../../lib/erros';
import {
  caixaDoItem,
  codigoDaCaixa,
  criarLayout,
  idsDeCaixasNaBusca,
  layoutIgual,
  moverCaixa,
  moverItem,
  ordensParaSalvar,
  type LayoutCaixas,
} from '../../lib/caixas';
import { useAplicarEdicaoStorage, useStorageCaixas } from '../../hooks/useStorageCaixas';
import { useStorageItens } from '../../hooks/useStorageItens';
import { useStorageObs } from '../../hooks/useStorageObs';
import { useStorageAnexos } from '../../hooks/useStorageAnexos';
import { useStorageCategorias } from '../../hooks/useStorageCategorias';
import type { AnexoStorage, CaixaStorage, ItemStorage, ObsStorage } from '../../types';
import { CaixaConteudo, type DadosStorage } from './CaixaConteudo';
import { CaixaModal } from './CaixaModal';
import { ClassificacoesModal } from './ClassificacoesModal';
import { EtiquetaModal } from './EtiquetaModal';
import { LeitorModal } from './LeitorModal';

const PREFIXO_CAIXA = 'caixa:';
const PREFIXO_ITEM = 'item:';
const PREFIXO_SOLTA = 'solta:';

/** Item só disputa posição com outros itens e com a área de soltar; caixa só com outras caixas. */
const detectarColisao: CollisionDetection = (args) => {
  const arrastandoCaixa = String(args.active.id).startsWith(PREFIXO_CAIXA);
  const candidatos = args.droppableContainers.filter((c) => String(c.id).startsWith(PREFIXO_CAIXA) === arrastandoCaixa);
  return closestCenter({ ...args, droppableContainers: candidatos });
};

function agrupar<T>(lista: T[], chave: (x: T) => string): Map<string, T[]> {
  const mapa = new Map<string, T[]>();
  for (const x of lista) {
    const k = chave(x);
    const atual = mapa.get(k);
    if (atual) atual.push(x);
    else mapa.set(k, [x]);
  }
  return mapa;
}

function ItemArrastavel({ item, pendente, onMarcarExclusao, onDesfazerExclusao }: { item: ItemStorage; pendente: boolean; onMarcarExclusao: () => void; onDesfazerExclusao: () => void }) {
  const sortable = useSortable({ id: PREFIXO_ITEM + item.id });
  const style = { transform: CSS.Transform.toString(sortable.transform), transition: sortable.transition };
  return (
    <li ref={sortable.setNodeRef} style={style} className={`documentos-item storage-item-edicao${pendente ? ' documentos-item-pendente' : ''}`}>
      {!pendente && (
        <button type="button" className="btn-icone documentos-arrastar" aria-label={`Arrastar ${item.nome}`} title={`Arrastar ${item.nome}`} {...sortable.attributes} {...sortable.listeners}>
          <IconeFuncao funcao="mover" />
        </button>
      )}
      <span className="documentos-titulo-botao storage-item-titulo">{item.nome}</span>
      {pendente ? (
        <button type="button" className="documentos-btn-desfazer" onClick={onDesfazerExclusao} title={`Desfazer exclusão de ${item.nome}`}>
          Desfazer
        </button>
      ) : (
        <button type="button" className="btn-icone btn-icone-perigo" onClick={onMarcarExclusao} title={`Excluir ${item.nome}`} aria-label={`Excluir ${item.nome}`}>
          <IconeFuncao funcao="excluir" />
        </button>
      )}
    </li>
  );
}

function AreaSoltar({ caixaId }: { caixaId: string }) {
  const { setNodeRef, isOver } = useDroppable({ id: PREFIXO_SOLTA + caixaId });
  return (
    <li ref={setNodeRef} className={`storage-area-soltar${isOver ? ' storage-area-soltar-ativa' : ''}`}>
      Solte um item aqui
    </li>
  );
}

interface CaixaArrastavelProps {
  caixa: CaixaStorage;
  nomeExibido: string;
  renomeacaoPendente: boolean;
  pendente: boolean;
  editando: boolean;
  rascunho: string;
  itens: ItemStorage[];
  itensPendentes: Set<string>;
  onRascunhoChange: (v: string) => void;
  onIniciarRenomear: () => void;
  onConfirmarEdicao: () => void;
  onCancelarEdicao: () => void;
  onMarcarExclusao: () => void;
  onDesfazerExclusao: () => void;
  onMarcarExclusaoItem: (id: string) => void;
  onDesfazerExclusaoItem: (id: string) => void;
}

/** Caixa no modo de edição: arrastar, renomear, marcar exclusão; os itens dentro também se arrastam (inclusive para outra caixa). */
function CaixaEdicao(props: CaixaArrastavelProps) {
  const { caixa, nomeExibido, pendente, editando, rascunho, itens, itensPendentes } = props;
  const sortable = useSortable({ id: PREFIXO_CAIXA + caixa.id });
  const style = { transform: CSS.Transform.toString(sortable.transform), transition: sortable.transition };

  function aoTeclar(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') {
      e.preventDefault();
      props.onConfirmarEdicao();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      props.onCancelarEdicao();
    }
  }

  return (
    <div ref={sortable.setNodeRef} style={style} className={`storage-caixa-edicao${pendente ? ' storage-caixa-pendente' : ''}`}>
      {editando ? (
        <div className="documentos-item documentos-item-editando">
          <input value={rascunho} onChange={(e) => props.onRascunhoChange(e.target.value)} onKeyDown={aoTeclar} autoFocus aria-label={`Renomear ${nomeExibido}`} />
          <button type="button" className="btn-icone" onClick={props.onConfirmarEdicao} title="Confirmar" aria-label="Confirmar">
            <IconeFuncao funcao="confirmar" />
          </button>
          <button type="button" className="btn-icone" onClick={props.onCancelarEdicao} title="Cancelar" aria-label="Cancelar">
            <IconeFuncao funcao="fechar" />
          </button>
        </div>
      ) : (
        <div className={`documentos-item${props.renomeacaoPendente ? ' documentos-item-renomeado' : ''}`}>
          {!pendente && (
            <button type="button" className="btn-icone documentos-arrastar" aria-label={`Arrastar caixa ${nomeExibido}`} title={`Arrastar caixa ${nomeExibido}`} {...sortable.attributes} {...sortable.listeners}>
              <IconeFuncao funcao="mover" />
            </button>
          )}
          <span className="documentos-titulo-botao">
            {nomeExibido} <span className="storage-codigo">{codigoDaCaixa(caixa.numero)}</span>
          </span>
          {!pendente && (
            <button type="button" className="btn-icone" onClick={props.onIniciarRenomear} title={`Renomear ${nomeExibido}`} aria-label={`Renomear ${nomeExibido}`}>
              <IconeFuncao funcao="editar" />
            </button>
          )}
          {pendente ? (
            <button type="button" className="documentos-btn-desfazer" onClick={props.onDesfazerExclusao} title={`Desfazer exclusão de ${nomeExibido}`}>
              Desfazer
            </button>
          ) : (
            <button type="button" className="btn-icone btn-icone-perigo" onClick={props.onMarcarExclusao} title={`Excluir ${nomeExibido}`} aria-label={`Excluir ${nomeExibido}`}>
              <IconeFuncao funcao="excluir" />
            </button>
          )}
        </div>
      )}
      {!pendente && (
        <SortableContext items={itens.map((i) => PREFIXO_ITEM + i.id)} strategy={verticalListSortingStrategy}>
          <ul className="storage-itens-edicao">
            {itens.map((item) => (
              <ItemArrastavel
                key={item.id}
                item={item}
                pendente={itensPendentes.has(item.id)}
                onMarcarExclusao={() => props.onMarcarExclusaoItem(item.id)}
                onDesfazerExclusao={() => props.onDesfazerExclusaoItem(item.id)}
              />
            ))}
            <AreaSoltar caixaId={caixa.id} />
          </ul>
        </SortableContext>
      )}
    </div>
  );
}

export function StoragePage() {
  const caixasQ = useStorageCaixas();
  const itensQ = useStorageItens();
  const obsQ = useStorageObs();
  const anexosQ = useStorageAnexos();
  const categoriasQ = useStorageCategorias();
  const aplicarEdicao = useAplicarEdicaoStorage();
  const { confirmar } = useDialogos();
  const { mostrarToast } = useToast();

  const [busca, setBusca] = useState('');
  const [modoEdicao, setModoEdicao] = useState(false);
  const [layoutLocal, setLayoutLocal] = useState<LayoutCaixas | null>(null);
  const [exclusoesCaixas, setExclusoesCaixas] = useState<Set<string>>(new Set());
  const [exclusoesItens, setExclusoesItens] = useState<Set<string>>(new Set());
  const [renomeacoes, setRenomeacoes] = useState<Map<string, string>>(new Map());
  const [edicaoAtivaId, setEdicaoAtivaId] = useState<string | null>(null);
  const [rascunhoNome, setRascunhoNome] = useState('');
  const [expandidos, setExpandidos] = useState<Set<string>>(new Set());
  const [salvando, setSalvando] = useState(false);

  const [leitorAberto, setLeitorAberto] = useState(false);
  const [caixaModal, setCaixaModal] = useState<{ caixa: CaixaStorage | null } | null>(null);
  const [etiquetaDe, setEtiquetaDe] = useState<CaixaStorage | null>(null);
  const [detalheId, setDetalheId] = useState<string | null>(null);
  const [classificacoesAberto, setClassificacoesAberto] = useState(false);

  const caixas = useMemo(() => caixasQ.data ?? [], [caixasQ.data]);
  const itens = useMemo(() => itensQ.data ?? [], [itensQ.data]);

  const dados = useMemo<DadosStorage>(() => {
    const itensPorCaixa = new Map<string, ItemStorage[]>();
    const layout = criarLayout(caixas, itens);
    const itemPorId = new Map(itens.map((i) => [i.id, i]));
    for (const [caixaId, ids] of Object.entries(layout.itens)) {
      itensPorCaixa.set(caixaId, ids.map((id) => itemPorId.get(id)).filter((i): i is ItemStorage => !!i));
    }
    return {
      itensPorCaixa,
      obsPorItem: agrupar<ObsStorage>(obsQ.data ?? [], (o) => o.item_id),
      anexosPorItem: agrupar<AnexoStorage>(anexosQ.data ?? [], (a) => a.item_id),
      categoriaPorId: new Map((categoriasQ.data ?? []).map((c) => [c.id, c])),
    };
  }, [caixas, itens, obsQ.data, anexosQ.data, categoriasQ.data]);

  const layoutBase = useMemo(() => criarLayout(caixas, itens), [caixas, itens]);
  const layout = layoutLocal ?? layoutBase;
  const haAlteracaoDeOrdem = layoutLocal !== null && !layoutIgual(layoutBase, layoutLocal);
  const temPendencias = haAlteracaoDeOrdem || exclusoesCaixas.size > 0 || exclusoesItens.size > 0 || renomeacoes.size > 0;
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  const caixaPorId = useMemo(() => new Map(caixas.map((c) => [c.id, c])), [caixas]);
  const itemPorId = useMemo(() => new Map(itens.map((i) => [i.id, i])), [itens]);
  const q = busca.trim();
  const idsNaBusca = useMemo(() => idsDeCaixasNaBusca(caixas, itens, q), [caixas, itens, q]);
  const caixasVisiveis = layout.caixas.map((id) => caixaPorId.get(id)).filter((c): c is CaixaStorage => !!c && idsNaBusca.has(c.id));

  const carregando = caixasQ.isLoading || itensQ.isLoading || obsQ.isLoading || anexosQ.isLoading || categoriasQ.isLoading;
  const erro = caixasQ.error ?? itensQ.error ?? obsQ.error ?? anexosQ.error ?? categoriasQ.error;

  function nomeAtual(caixa: CaixaStorage): string {
    return renomeacoes.get(caixa.id) ?? caixa.nome;
  }

  function alternarExpandir(id: string) {
    setExpandidos((atual) => {
      const novo = new Set(atual);
      if (novo.has(id)) novo.delete(id);
      else novo.add(id);
      return novo;
    });
  }

  function cancelarEdicaoNome() {
    setEdicaoAtivaId(null);
    setRascunhoNome('');
  }

  function confirmarEdicaoNome(caixa: CaixaStorage) {
    const novo = rascunhoNome.trim();
    cancelarEdicaoNome();
    if (!novo || novo === nomeAtual(caixa)) return;
    setRenomeacoes((atual) => {
      const mapa = new Map(atual);
      if (novo === caixa.nome) mapa.delete(caixa.id);
      else mapa.set(caixa.id, novo);
      return mapa;
    });
  }

  function alternarEm(setter: (fn: (atual: Set<string>) => Set<string>) => void, id: string, ligar: boolean) {
    setter((atual) => {
      const novo = new Set(atual);
      if (ligar) novo.add(id);
      else novo.delete(id);
      return novo;
    });
  }

  function sairModoEdicao() {
    setModoEdicao(false);
    setLayoutLocal(null);
    setExclusoesCaixas(new Set());
    setExclusoesItens(new Set());
    setRenomeacoes(new Map());
    cancelarEdicaoNome();
  }

  function entrarModoEdicao() {
    setBusca('');
    setModoEdicao(true);
  }

  function aoArrastarSobre(event: DragOverEvent) {
    const { active, over } = event;
    if (!over) return;
    const ativo = String(active.id);
    if (!ativo.startsWith(PREFIXO_ITEM)) return;
    const itemId = ativo.slice(PREFIXO_ITEM.length);
    const alvo = String(over.id);
    const base = layoutLocal ?? layoutBase;
    const origem = caixaDoItem(base, itemId);
    let destino: string | null = null;
    let sobreItem: string | undefined;
    if (alvo.startsWith(PREFIXO_ITEM)) {
      sobreItem = alvo.slice(PREFIXO_ITEM.length);
      destino = caixaDoItem(base, sobreItem);
    } else if (alvo.startsWith(PREFIXO_SOLTA)) {
      destino = alvo.slice(PREFIXO_SOLTA.length);
    }
    // Dentro da mesma caixa quem reordena é o soltar (onDragEnd); aqui só a troca de caixa.
    if (!destino || !origem || destino === origem) return;
    setLayoutLocal(moverItem(base, itemId, destino, sobreItem));
  }

  function aoSoltar(event: DragEndEvent) {
    const { active, over } = event;
    if (!over) return;
    const ativo = String(active.id);
    const alvo = String(over.id);
    const base = layoutLocal ?? layoutBase;
    if (ativo.startsWith(PREFIXO_CAIXA) && alvo.startsWith(PREFIXO_CAIXA)) {
      setLayoutLocal(moverCaixa(base, ativo.slice(PREFIXO_CAIXA.length), alvo.slice(PREFIXO_CAIXA.length)));
      return;
    }
    if (ativo.startsWith(PREFIXO_ITEM) && alvo.startsWith(PREFIXO_ITEM)) {
      const itemId = ativo.slice(PREFIXO_ITEM.length);
      const sobreId = alvo.slice(PREFIXO_ITEM.length);
      const caixaId = caixaDoItem(base, itemId);
      if (caixaId && itemId !== sobreId && caixaDoItem(base, sobreId) === caixaId) {
        setLayoutLocal(moverItem(base, itemId, caixaId, sobreId));
      }
    }
  }

  async function salvarEdicao() {
    if (!temPendencias) return;
    if (exclusoesCaixas.size > 0 || exclusoesItens.size > 0) {
      const itensNasCaixas = [...exclusoesCaixas].reduce((soma, id) => soma + (layout.itens[id]?.length ?? 0), 0);
      const partes: string[] = [];
      if (exclusoesCaixas.size > 0) partes.push(`${exclusoesCaixas.size} caixa(s), com os ${itensNasCaixas} item(ns) que estão nelas`);
      if (exclusoesItens.size > 0) partes.push(`${exclusoesItens.size} item(ns)`);
      const ok = await confirmar({
        titulo: 'Confirmar exclusão?',
        mensagem: `Serão excluídos: ${partes.join(' e ')}. As observações e os anexos também serão apagados. Essa ação não pode ser desfeita.`,
        confirmarRotulo: 'Excluir e salvar',
        perigoso: true,
      });
      if (!ok) return;
    }
    setSalvando(true);
    try {
      const ordens = ordensParaSalvar(layoutBase, layout);
      await aplicarEdicao.mutateAsync({
        caixas: ordens.caixas,
        itens: ordens.itens,
        renomeacoes: [...renomeacoes].map(([id, nome]) => ({ id, nome })),
        caixasExcluidas: [...exclusoesCaixas],
        itensExcluidos: [...exclusoesItens],
      });
      mostrarToast('Alterações salvas.');
      sairModoEdicao();
    } catch (err) {
      mostrarToast(mensagemDeErro(err), 'erro');
    } finally {
      setSalvando(false);
    }
  }

  function aoLerCodigo(numero: number) {
    setLeitorAberto(false);
    const caixa = caixas.find((c) => c.numero === numero);
    if (!caixa) {
      mostrarToast(`Caixa ${codigoDaCaixa(numero)} não encontrada.`, 'erro');
      return;
    }
    setDetalheId(caixa.id);
  }

  const detalhe = detalheId ? (caixaPorId.get(detalheId) ?? null) : null;
  const ordemNova = caixas.reduce((maior, c) => Math.max(maior, c.ordem), 0) + 1;

  return (
    <div className="documentos-lista-pagina">
      <div className="storage-topo">
        <button type="button" className="storage-botao-principal" onClick={() => setLeitorAberto(true)} disabled={modoEdicao}>
          <IconeCamera /> Ler código
        </button>
        <button type="button" className="storage-botao-principal" onClick={() => setCaixaModal({ caixa: null })} disabled={modoEdicao}>
          <IconeQr /> Nova caixa
        </button>
      </div>

      <h3 className="storage-secao-titulo">Caixas</h3>
      <div className="documentos-busca-linha">
        <input
          type="search"
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          placeholder="Buscar caixa ou item…"
          aria-label="Buscar caixa ou item"
          disabled={modoEdicao}
        />
        <button type="button" onClick={() => setClassificacoesAberto(true)} disabled={modoEdicao}>
          Classificações
        </button>
        <button
          type="button"
          className={`btn-icone${modoEdicao ? ' documentos-modo-ativo' : ''}`}
          onClick={() => (modoEdicao ? sairModoEdicao() : entrarModoEdicao())}
          title={modoEdicao ? 'Sair do modo de edição' : 'Editar (arrastar, renomear, excluir)'}
          aria-label={modoEdicao ? 'Sair do modo de edição' : 'Entrar no modo de edição'}
        >
          <IconeFuncao funcao="editar" />
        </button>
        <button
          type="button"
          className="btn-icone"
          onClick={salvarEdicao}
          disabled={!modoEdicao || !temPendencias || salvando}
          title="Salvar alterações"
          aria-label="Salvar alterações"
        >
          <IconeFuncao funcao="salvar" />
        </button>
      </div>

      {carregando ? (
        <p>Carregando…</p>
      ) : erro ? (
        <p role="alert">{mensagemDeErro(erro)}</p>
      ) : caixasVisiveis.length === 0 ? (
        <p className="documentos-vazio">{q ? 'Nenhum resultado.' : 'Nenhuma caixa ainda.'}</p>
      ) : modoEdicao ? (
        <DndContext sensors={sensors} collisionDetection={detectarColisao} onDragOver={aoArrastarSobre} onDragEnd={aoSoltar}>
          <SortableContext items={caixasVisiveis.map((c) => PREFIXO_CAIXA + c.id)} strategy={verticalListSortingStrategy}>
            <div className="documentos-lista-area">
              {caixasVisiveis.map((caixa) => (
                <CaixaEdicao
                  key={caixa.id}
                  caixa={caixa}
                  nomeExibido={nomeAtual(caixa)}
                  renomeacaoPendente={renomeacoes.has(caixa.id)}
                  pendente={exclusoesCaixas.has(caixa.id)}
                  editando={edicaoAtivaId === caixa.id}
                  rascunho={rascunhoNome}
                  itens={(layout.itens[caixa.id] ?? []).map((id) => itemPorId.get(id)).filter((i): i is ItemStorage => !!i)}
                  itensPendentes={exclusoesItens}
                  onRascunhoChange={setRascunhoNome}
                  onIniciarRenomear={() => {
                    setEdicaoAtivaId(caixa.id);
                    setRascunhoNome(nomeAtual(caixa));
                  }}
                  onConfirmarEdicao={() => confirmarEdicaoNome(caixa)}
                  onCancelarEdicao={cancelarEdicaoNome}
                  onMarcarExclusao={() => alternarEm(setExclusoesCaixas, caixa.id, true)}
                  onDesfazerExclusao={() => alternarEm(setExclusoesCaixas, caixa.id, false)}
                  onMarcarExclusaoItem={(id) => alternarEm(setExclusoesItens, id, true)}
                  onDesfazerExclusaoItem={(id) => alternarEm(setExclusoesItens, id, false)}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      ) : (
        <div className="documentos-lista-area">
          {caixasVisiveis.map((caixa) => {
            const expandido = q ? true : expandidos.has(caixa.id);
            return (
              <div key={caixa.id}>
                <div className="documentos-item">
                  <button type="button" className="documentos-titulo-botao" onClick={() => alternarExpandir(caixa.id)} aria-expanded={expandido}>
                    <span className="documentos-seta">{expandido ? '▾' : '▸'}</span>
                    {caixa.nome} <span className="storage-codigo">{codigoDaCaixa(caixa.numero)}</span>
                  </button>
                  <button type="button" className="btn-icone" onClick={() => setEtiquetaDe(caixa)} title={`Etiqueta de ${caixa.nome}`} aria-label={`Etiqueta de ${caixa.nome}`}>
                    <IconeQr />
                  </button>
                  <button type="button" onClick={() => setCaixaModal({ caixa })}>
                    Editar
                  </button>
                </div>
                {expandido && (
                  <div className="documentos-item-expandido">
                    <CaixaConteudo caixaId={caixa.id} dados={dados} />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {leitorAberto && <LeitorModal onFechar={() => setLeitorAberto(false)} onLido={aoLerCodigo} />}

      {caixaModal && (
        <CaixaModal
          key={caixaModal.caixa?.id ?? 'nova'}
          caixa={caixaModal.caixa}
          dados={dados}
          categorias={categoriasQ.data ?? []}
          ordemNova={ordemNova}
          onFechar={() => setCaixaModal(null)}
          onSalvo={(id) => {
            const nova = caixaModal.caixa === null;
            setCaixaModal(null);
            if (nova) setDetalheId(id);
          }}
        />
      )}

      {classificacoesAberto && <ClassificacoesModal categorias={categoriasQ.data ?? []} itens={itens} onFechar={() => setClassificacoesAberto(false)} />}

      {etiquetaDe && <EtiquetaModal caixa={etiquetaDe} onFechar={() => setEtiquetaDe(null)} />}

      {detalhe && (
        <ModalBase aberto rotulo={`Caixa ${detalhe.nome}`} onFechar={() => setDetalheId(null)} classe="modal-edicao modal-storage">
          <h3 className="modal-titulo">
            {detalhe.nome} <span className="storage-codigo">{codigoDaCaixa(detalhe.numero)}</span>
          </h3>
          <CaixaConteudo caixaId={detalhe.id} dados={dados} />
          <div className="modal-acoes">
            <button
              type="button"
              onClick={() => {
                setDetalheId(null);
                setCaixaModal({ caixa: detalhe });
              }}
            >
              Editar
            </button>
            <button
              type="button"
              onClick={() => {
                setDetalheId(null);
                setEtiquetaDe(detalhe);
              }}
            >
              Etiqueta
            </button>
            <button type="button" onClick={() => setDetalheId(null)}>
              Fechar
            </button>
          </div>
        </ModalBase>
      )}
    </div>
  );
}
