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
import { IconeCaixa } from '../../components/IconeCaixa';
import { TagsChips } from '../../components/TagsChips';
import { useDialogos } from '../../components/Dialogo';
import { useToast } from '../../components/Toast';
import { mensagemDeErro } from '../../lib/erros';
import {
  caixaDoItem,
  codigoDaCaixa,
  criarLayout,
  idsDeCaixasComTags,
  idsDeCaixasNaBusca,
  layoutIgual,
  moverCaixa,
  moverItem,
  nomeDaCopia,
  ordensParaSalvar,
  tagsDaCaixa,
  type LayoutCaixas,
} from '../../lib/caixas';
import { useAplicarEdicaoStorage, useSalvarCaixa, useStorageCaixas } from '../../hooks/useStorageCaixas';
import { useIconesUsos, useSalvarUsoIcone } from '../../hooks/useIconesUsos';
import { useTemaEfetivo } from '../../hooks/useTema';
import { resolverUso } from '../../lib/iconesUsos';
import { useStorageItens } from '../../hooks/useStorageItens';
import { useStorageObs } from '../../hooks/useStorageObs';
import { useStorageAnexos, useStorageCaixaAnexos } from '../../hooks/useStorageAnexos';
import { useTagsItens } from '../../hooks/useTagsItens';
import type { AnexoCaixaStorage, AnexoStorage, CaixaStorage, ItemStorage, ObsStorage, TagItem } from '../../types';
import { CaixaConteudo, type DadosStorage } from './CaixaConteudo';
import { CaixaModal } from './CaixaModal';
import { EtiquetaModal } from './EtiquetaModal';
import { EtiquetasLoteModal } from './EtiquetasLoteModal';
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

function ItemArrastavel({
  item,
  pendente,
  selecionado,
  tagNome,
  tagHerdada,
  onAlternarSelecao,
  onEditar,
  onMarcarExclusao,
  onDesfazerExclusao,
}: {
  item: ItemStorage;
  pendente: boolean;
  selecionado: boolean;
  /** Tag que vale para o item (a própria, a pendente de aplicar ou a da caixa). */
  tagNome: string | undefined;
  tagHerdada: boolean;
  onAlternarSelecao: () => void;
  /** Abre o editor completo da caixa deste item (nome, tags, anexos, observações). */
  onEditar: () => void;
  onMarcarExclusao: () => void;
  onDesfazerExclusao: () => void;
}) {
  const sortable = useSortable({ id: PREFIXO_ITEM + item.id });
  const style = { transform: CSS.Transform.toString(sortable.transform), transition: sortable.transition };
  return (
    <li ref={sortable.setNodeRef} style={style} className={`documentos-item storage-item-edicao${pendente ? ' documentos-item-pendente' : ''}`}>
      {!pendente && (
        <input type="checkbox" checked={selecionado} onChange={onAlternarSelecao} aria-label={`Selecionar ${item.nome}`} title={`Selecionar ${item.nome}`} />
      )}
      {!pendente && (
        <button type="button" className="btn-icone documentos-arrastar" aria-label={`Arrastar ${item.nome}`} title={`Arrastar ${item.nome}`} {...sortable.attributes} {...sortable.listeners}>
          <IconeFuncao funcao="mover" />
        </button>
      )}
      <button type="button" className="documentos-titulo-botao storage-item-titulo" onClick={onEditar} disabled={pendente} title={`Editar ${item.nome}`} aria-label={`Editar ${item.nome}`}>
        {item.nome}
      </button>
      {tagNome && <span className={tagHerdada ? 'storage-item-tag storage-item-tag-herdada' : 'storage-item-tag'}>{tagNome}</span>}
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
  selecionados: Set<string>;
  /** Tag (nome) que vale para cada item, já considerando o que está pendente. */
  tagDoItem: (item: ItemStorage) => { nome: string | undefined; herdada: boolean };
  onAlternarSelecao: (id: string) => void;
  onRascunhoChange: (v: string) => void;
  onIniciarRenomear: () => void;
  onConfirmarEdicao: () => void;
  onCancelarEdicao: () => void;
  onMarcarExclusao: () => void;
  onDesfazerExclusao: () => void;
  onMarcarExclusaoItem: (id: string) => void;
  onDesfazerExclusaoItem: (id: string) => void;
  onEditarCaixa: () => void;
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
          <button type="button" className="documentos-titulo-botao" onClick={props.onIniciarRenomear} disabled={pendente} title={`Renomear ${nomeExibido}`} aria-label={`Renomear ${nomeExibido}`}>
            <IconeCaixa caixaId={caixa.id} /> {nomeExibido} <span className="storage-codigo">{codigoDaCaixa(caixa.numero)}</span>
          </button>
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
                selecionado={props.selecionados.has(item.id)}
                tagNome={props.tagDoItem(item).nome}
                tagHerdada={props.tagDoItem(item).herdada}
                onAlternarSelecao={() => props.onAlternarSelecao(item.id)}
                onEditar={props.onEditarCaixa}
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

function textoDeItens(quantidade: number): string {
  return quantidade === 1 ? '1 item' : `${quantidade} itens`;
}

/** Tags da caixa: a principal e, ao lado, as tags próprias dos itens que são diferentes dela. */
function ChipsDaCaixa({ caixa, dados }: { caixa: CaixaStorage; dados: DadosStorage }) {
  const { principal, dosItens } = tagsDaCaixa(caixa, dados.itensPorCaixa.get(caixa.id) ?? []);
  const tags = [principal, ...dosItens].map((id) => (id ? dados.tagPorId.get(id) : undefined)).filter((t): t is TagItem => !!t);
  if (tags.length === 0) return null;
  return <TagsChips tags={tags} />;
}

export function StoragePage() {
  const caixasQ = useStorageCaixas();
  const itensQ = useStorageItens();
  const obsQ = useStorageObs();
  const anexosQ = useStorageAnexos();
  const anexosCaixaQ = useStorageCaixaAnexos();
  const tagsQ = useTagsItens();
  const aplicarEdicao = useAplicarEdicaoStorage();
  const salvarCaixa = useSalvarCaixa();
  const { data: usosIcones = [] } = useIconesUsos();
  const temaEfetivo = useTemaEfetivo();
  const salvarUso = useSalvarUsoIcone();
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
  const [selecionados, setSelecionados] = useState<Set<string>>(new Set());
  /** Tags aplicadas em lote e ainda não salvas (null = seguir a tag da caixa). */
  const [tagsPendentes, setTagsPendentes] = useState<Map<string, string | null>>(new Map());
  const [destinoLote, setDestinoLote] = useState('');
  const [tagLote, setTagLote] = useState('');

  const [leitorAberto, setLeitorAberto] = useState(false);
  const [caixaModal, setCaixaModal] = useState<{ caixa: CaixaStorage | null } | null>(null);
  const [etiquetaDe, setEtiquetaDe] = useState<CaixaStorage | null>(null);
  const [detalheId, setDetalheId] = useState<string | null>(null);
  const [tagIdsFiltro, setTagIdsFiltro] = useState<string[]>([]);
  const [loteAberto, setLoteAberto] = useState(false);

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
      tagPorId: new Map((tagsQ.data ?? []).map((t) => [t.id, t])),
      anexosPorCaixa: agrupar<AnexoCaixaStorage>(anexosCaixaQ.data ?? [], (a) => a.storage_id),
      caixaPorId: new Map(caixas.map((c) => [c.id, c])),
    };
  }, [caixas, itens, obsQ.data, anexosQ.data, anexosCaixaQ.data, tagsQ.data]);

  const layoutBase = useMemo(() => criarLayout(caixas, itens), [caixas, itens]);
  const layout = layoutLocal ?? layoutBase;
  const haAlteracaoDeOrdem = layoutLocal !== null && !layoutIgual(layoutBase, layoutLocal);
  const temPendencias = haAlteracaoDeOrdem || exclusoesCaixas.size > 0 || exclusoesItens.size > 0 || renomeacoes.size > 0 || tagsPendentes.size > 0;
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  const caixaPorId = useMemo(() => new Map(caixas.map((c) => [c.id, c])), [caixas]);
  const itemPorId = useMemo(() => new Map(itens.map((i) => [i.id, i])), [itens]);
  const q = busca.trim();
  const idsNaBusca = useMemo(() => idsDeCaixasNaBusca(caixas, itens, q), [caixas, itens, q]);
  const idsComTags = useMemo(() => idsDeCaixasComTags(caixas, itens, tagIdsFiltro), [caixas, itens, tagIdsFiltro]);
  const caixasVisiveis = layout.caixas.map((id) => caixaPorId.get(id)).filter((c): c is CaixaStorage => !!c && idsNaBusca.has(c.id) && idsComTags.has(c.id));

  const carregando = caixasQ.isLoading || itensQ.isLoading || obsQ.isLoading || anexosQ.isLoading || anexosCaixaQ.isLoading || tagsQ.isLoading;
  const erro = caixasQ.error ?? itensQ.error ?? obsQ.error ?? anexosQ.error ?? anexosCaixaQ.error ?? tagsQ.error;

  /** Tag que vale para o item no modo de edição: a pendente, a própria ou a da caixa onde ele está agora. */
  function tagDoItem(item: ItemStorage): { nome: string | undefined; herdada: boolean } {
    const caixaAtual = caixaPorId.get(caixaDoItem(layout, item.id) ?? item.storage_id);
    const propria = tagsPendentes.has(item.id) ? (tagsPendentes.get(item.id) ?? null) : item.tag_id;
    const efetiva = propria ?? caixaAtual?.tag_id ?? null;
    return { nome: efetiva ? dados.tagPorId.get(efetiva)?.nome : undefined, herdada: propria === null && efetiva !== null };
  }

  function alternarSelecao(id: string) {
    setSelecionados((atual) => {
      const novo = new Set(atual);
      if (novo.has(id)) novo.delete(id);
      else novo.add(id);
      return novo;
    });
  }

  function moverSelecionados() {
    if (!destinoLote) return;
    let novoLayout = layout;
    for (const id of selecionados) {
      if (!exclusoesItens.has(id)) novoLayout = moverItem(novoLayout, id, destinoLote);
    }
    setLayoutLocal(novoLayout);
    setSelecionados(new Set());
    setDestinoLote('');
  }

  function aplicarTagSelecionados() {
    if (!tagLote) return;
    const tag = tagLote === 'segue' ? null : tagLote;
    setTagsPendentes((atual) => {
      const mapa = new Map(atual);
      for (const id of selecionados) {
        const original = itemPorId.get(id)?.tag_id ?? null;
        if (tag === original) mapa.delete(id);
        else mapa.set(id, tag);
      }
      return mapa;
    });
    setSelecionados(new Set());
    setTagLote('');
  }

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
    setSelecionados(new Set());
    setTagsPendentes(new Map());
    setDestinoLote('');
    setTagLote('');
    cancelarEdicaoNome();
  }

  function entrarModoEdicao() {
    setBusca('');
    setModoEdicao(true);
  }

  async function pedirSairModoEdicao() {
    if (temPendencias) {
      const ok = await confirmar({ titulo: 'Descartar as alterações?', mensagem: 'O que você alterou não será salvo.', confirmarRotulo: 'Descartar', perigoso: true });
      if (!ok) return;
    }
    sairModoEdicao();
  }

  /** O editor completo da caixa trabalha sobre o que está salvo: com alterações pendentes, pergunta antes de descartar. */
  async function abrirEditorDaCaixa(caixa: CaixaStorage) {
    if (temPendencias) {
      const ok = await confirmar({ titulo: 'Descartar as alterações?', mensagem: 'Para editar a caixa por inteiro, as alterações pendentes da lista serão descartadas.', confirmarRotulo: 'Descartar', perigoso: true });
      if (!ok) return;
    }
    sairModoEdicao();
    setCaixaModal({ caixa });
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
        mensagem: `Serão excluídos: ${partes.join(' e ')}. As observações e os anexos (inclusive os anexos das caixas) também serão apagados. Essa ação não pode ser desfeita.`,
        confirmarRotulo: 'Excluir e salvar',
        perigoso: true,
      });
      if (!ok) return;
    }
    setSalvando(true);
    try {
      const ordens = ordensParaSalvar(layoutBase, layout);
      const resultado = await aplicarEdicao.mutateAsync({
        caixas: ordens.caixas,
        itens: ordens.itens,
        renomeacoes: [...renomeacoes].map(([id, nome]) => ({ id, nome })),
        caixasExcluidas: [...exclusoesCaixas],
        itensExcluidos: [...exclusoesItens],
        tagsItens: [...tagsPendentes].filter(([id]) => !exclusoesItens.has(id)).map(([id, tag_id]) => ({ id, tag_id })),
      });
      mostrarToast(resultado === 'enfileirada' ? 'Alterações salvas no aparelho. Serão enviadas quando houver internet.' : 'Alterações salvas.');
      sairModoEdicao();
    } catch (err) {
      mostrarToast(mensagemDeErro(err), 'erro');
    } finally {
      setSalvando(false);
    }
  }

  /** Duplica a caixa: mesmo nome com (cópia), mesma tag, ícone e itens com observações. Os anexos não são copiados. */
  async function duplicarCaixa(caixa: CaixaStorage) {
    const novoId = crypto.randomUUID();
    const itensDela = dados.itensPorCaixa.get(caixa.id) ?? [];
    try {
      const resultado = await salvarCaixa.mutateAsync({
        id: novoId,
        numero: caixas.reduce((maior, c) => Math.max(maior, c.numero), 0) + 1,
        nome: nomeDaCopia(caixa.nome, caixas.map((c) => c.nome)),
        tag_id: caixa.tag_id,
        novo: true,
        ordemNova: caixas.reduce((maior, c) => Math.max(maior, c.ordem), 0) + 1,
        itens: itensDela.map((item) => ({
          id: crypto.randomUUID(),
          nome: item.nome,
          quantidade: item.quantidade,
          tag_id: item.tag_id,
          obs: (dados.obsPorItem.get(item.id) ?? []).map((o) => o.texto),
          anexosNovos: [],
          anexosRemovidos: [],
        })),
        itensRemovidos: [],
      });
      const uso = resolverUso(usosIcones, 'caixa', caixa.id, temaEfetivo);
      let iconeCopiado = true;
      if (uso) {
        try {
          const { id: _id, ...semId } = uso;
          void _id;
          await salvarUso.mutateAsync({ ...semId, alvo_id: novoId });
        } catch {
          iconeCopiado = false;
        }
      }
      const aviso = iconeCopiado ? '' : ' O ícone não foi copiado (precisa de internet).';
      mostrarToast(`${resultado === 'enfileirada' ? 'Caixa duplicada no aparelho. Será enviada quando houver internet.' : 'Caixa duplicada.'} Os anexos não são copiados.${aviso}`);
    } catch (err) {
      mostrarToast(mensagemDeErro(err), 'erro');
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
        <button type="button" className="storage-botao-principal" onClick={() => setLoteAberto(true)} disabled={modoEdicao}>
          <IconeQr /> Etiquetas
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
        <button
          type="button"
          className={`btn-icone${modoEdicao ? ' documentos-modo-ativo' : ''}`}
          onClick={() => (modoEdicao ? void pedirSairModoEdicao() : entrarModoEdicao())}
          title={modoEdicao ? 'Sair do modo de edição' : 'Editar (arrastar, renomear, excluir; toque no item para editar a caixa)'}
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

      {(tagsQ.data ?? []).length > 0 && (
        <div className="manutencao-grupo-filtro" role="group" aria-label="Filtrar caixas por tag">
          {(tagsQ.data ?? []).map((tag) => (
            <button
              key={tag.id}
              type="button"
              className={tagIdsFiltro.includes(tag.id) ? 'tag-opcao tag-opcao-ativa' : 'tag-opcao'}
              aria-pressed={tagIdsFiltro.includes(tag.id)}
              disabled={modoEdicao}
              onClick={() => setTagIdsFiltro((atual) => (atual.includes(tag.id) ? atual.filter((id) => id !== tag.id) : [...atual, tag.id]))}
            >
              {tag.nome}
            </button>
          ))}
          {tagIdsFiltro.length > 0 && (
            <button type="button" className="tag-opcao" disabled={modoEdicao} onClick={() => setTagIdsFiltro([])}>
              Limpar filtro
            </button>
          )}
        </div>
      )}

      {carregando ? (
        <p>Carregando…</p>
      ) : erro ? (
        <p role="alert">{mensagemDeErro(erro)}</p>
      ) : caixasVisiveis.length === 0 ? (
        <p className="documentos-vazio">{q || tagIdsFiltro.length > 0 ? 'Nenhum resultado.' : 'Nenhuma caixa ainda.'}</p>
      ) : modoEdicao ? (
        <>
        {selecionados.size > 0 && (
          <div className="storage-lote-barra" role="group" aria-label="Ações nos itens selecionados">
            <span>{selecionados.size} item(ns) selecionado(s)</span>
            <select value={destinoLote} onChange={(e) => setDestinoLote(e.target.value)} aria-label="Mover os selecionados para a caixa">
              <option value="">Mover para…</option>
              {caixas.filter((c) => !exclusoesCaixas.has(c.id)).map((c) => (
                <option key={c.id} value={c.id}>
                  {nomeAtual(c)}
                </option>
              ))}
            </select>
            <button type="button" onClick={moverSelecionados} disabled={!destinoLote}>
              Mover
            </button>
            <select value={tagLote} onChange={(e) => setTagLote(e.target.value)} aria-label="Tag para os selecionados">
              <option value="">Escolher tag…</option>
              <option value="segue">Seguir a tag da caixa</option>
              {(tagsQ.data ?? []).map((t) => (
                <option key={t.id} value={t.id}>
                  {t.nome}
                </option>
              ))}
            </select>
            <button type="button" onClick={aplicarTagSelecionados} disabled={!tagLote}>
              Aplicar tag
            </button>
            <button type="button" onClick={() => setSelecionados(new Set())}>
              Limpar seleção
            </button>
          </div>
        )}
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
                  selecionados={selecionados}
                  tagDoItem={tagDoItem}
                  onAlternarSelecao={alternarSelecao}
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
                  onEditarCaixa={() => void abrirEditorDaCaixa(caixa)}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>
        </>
      ) : (
        <div className="documentos-lista-area">
          {caixasVisiveis.map((caixa) => {
            const expandido = q ? true : expandidos.has(caixa.id);
            return (
              <div key={caixa.id}>
                <div className="documentos-item">
                  <button type="button" className="documentos-titulo-botao" onClick={() => alternarExpandir(caixa.id)} aria-expanded={expandido}>
                    <span className="documentos-seta">{expandido ? '▾' : '▸'}</span>
                    <IconeCaixa caixaId={caixa.id} /> {caixa.nome} <span className="storage-codigo">{codigoDaCaixa(caixa.numero)}</span>
                    <span className="storage-contagem">{textoDeItens((dados.itensPorCaixa.get(caixa.id) ?? []).length)}</span>
                  </button>
                  <ChipsDaCaixa caixa={caixa} dados={dados} />
                  <button type="button" className="btn-icone" onClick={() => void duplicarCaixa(caixa)} title={`Duplicar ${caixa.nome}`} aria-label={`Duplicar ${caixa.nome}`}>
                    <IconeFuncao funcao="copiar" />
                  </button>
                  <button type="button" className="btn-icone" onClick={() => setEtiquetaDe(caixa)} title={`Etiqueta de ${caixa.nome}`} aria-label={`Etiqueta de ${caixa.nome}`}>
                    <IconeQr />
                  </button>
                </div>
                {expandido && (
                  <div className="documentos-item-expandido">
                    <CaixaConteudo caixaId={caixa.id} dados={dados} busca={q} />
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
          tags={tagsQ.data ?? []}
          ordemNova={ordemNova}
          numeroNovo={caixas.reduce((maior, c) => Math.max(maior, c.numero), 0) + 1}
          onFechar={() => setCaixaModal(null)}
          onSalvo={(id) => {
            const nova = caixaModal.caixa === null;
            setCaixaModal(null);
            if (nova) setDetalheId(id);
          }}
        />
      )}

      {loteAberto && <EtiquetasLoteModal caixas={caixas} nomesDasTags={new Map((tagsQ.data ?? []).map((t) => [t.id, t.nome]))} onFechar={() => setLoteAberto(false)} />}

      {etiquetaDe && <EtiquetaModal caixa={etiquetaDe} tagNome={etiquetaDe.tag_id ? dados.tagPorId.get(etiquetaDe.tag_id)?.nome : undefined} onFechar={() => setEtiquetaDe(null)} />}

      {detalhe && (
        <ModalBase aberto rotulo={`Caixa ${detalhe.nome}`} onFechar={() => setDetalheId(null)} classe="modal-edicao modal-storage" perguntarAoDescartar={false} titulo={
        <>
          <IconeCaixa caixaId={detalhe.id} tamanho={22} /> {detalhe.nome} <span className="storage-codigo">{codigoDaCaixa(detalhe.numero)}</span>
        </>
      } rodape={
        <>
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
          <button
            type="button"
            onClick={() => {
              setDetalheId(null);
              void duplicarCaixa(detalhe);
            }}
          >
            Duplicar
          </button>
        </>
      }>
          <ChipsDaCaixa caixa={detalhe} dados={dados} />
          <CaixaConteudo caixaId={detalhe.id} dados={dados} />
        </ModalBase>
      )}
    </div>
  );
}
