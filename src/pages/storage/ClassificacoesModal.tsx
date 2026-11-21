import { useMemo, useState, type KeyboardEvent } from 'react';
import { DndContext, PointerSensor, closestCenter, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core';
import { SortableContext, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { ModalBase } from '../../components/ModalBase';
import { IconeFuncao } from '../../components/IconeUso';
import { useDialogos } from '../../components/Dialogo';
import { useToast } from '../../components/Toast';
import { mensagemDeErro } from '../../lib/erros';
import { contarItensPorCategoria, moverCategoria, nomeDeCategoriaDuplicado } from '../../lib/categoriasStorage';
import { useAplicarEdicaoCategoriasStorage, useCriarCategoriaStorage } from '../../hooks/useStorageCategorias';
import type { CategoriaStorage, ItemStorage } from '../../types';

const MENSAGEM_NOME_DUPLICADO = 'Já existe uma classificação com esse nome.';

interface LinhaProps {
  categoria: CategoriaStorage;
  nomeExibido: string;
  quantidade: number;
  modoEdicao: boolean;
  renomeada: boolean;
  pendente: boolean;
  editando: boolean;
  rascunho: string;
  onRascunhoChange: (v: string) => void;
  onIniciarRenomear: () => void;
  onConfirmarRenomear: () => void;
  onCancelarRenomear: () => void;
  onMarcarExclusao: () => void;
  onDesfazerExclusao: () => void;
}

function LinhaClassificacao(props: LinhaProps) {
  const { categoria, nomeExibido, quantidade, modoEdicao, pendente, editando, rascunho } = props;
  const sortable = useSortable({ id: categoria.id });
  const style = { transform: CSS.Transform.toString(sortable.transform), transition: sortable.transition };

  function aoTeclar(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') {
      e.preventDefault();
      props.onConfirmarRenomear();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      props.onCancelarRenomear();
    }
  }

  if (editando) {
    return (
      <li ref={sortable.setNodeRef} style={style} className="documentos-item documentos-item-editando">
        <input value={rascunho} onChange={(e) => props.onRascunhoChange(e.target.value)} onKeyDown={aoTeclar} autoFocus aria-label={`Renomear ${nomeExibido}`} />
        <button type="button" className="btn-icone" onClick={props.onConfirmarRenomear} title="Confirmar" aria-label="Confirmar">
          <IconeFuncao funcao="confirmar" />
        </button>
        <button type="button" className="btn-icone" onClick={props.onCancelarRenomear} title="Cancelar" aria-label="Cancelar">
          <IconeFuncao funcao="fechar" />
        </button>
      </li>
    );
  }

  return (
    <li ref={sortable.setNodeRef} style={style} className={`documentos-item${pendente ? ' documentos-item-pendente' : ''}${props.renomeada ? ' documentos-item-renomeado' : ''}`}>
      {modoEdicao && !pendente && (
        <button type="button" className="btn-icone documentos-arrastar" aria-label={`Arrastar ${nomeExibido}`} title={`Arrastar ${nomeExibido}`} {...sortable.attributes} {...sortable.listeners}>
          <IconeFuncao funcao="mover" />
        </button>
      )}
      {modoEdicao && !pendente ? (
        <button type="button" className="documentos-titulo-botao" onClick={props.onIniciarRenomear} title={`Renomear ${nomeExibido}`} aria-label={`Renomear ${nomeExibido}`}>
          {nomeExibido} <span className="storage-codigo">({quantidade})</span>
        </button>
      ) : (
        <span className="documentos-titulo-botao">
          {nomeExibido} <span className="storage-codigo">({quantidade})</span>
        </span>
      )}
      {modoEdicao &&
        (pendente ? (
          <button type="button" className="documentos-btn-desfazer" onClick={props.onDesfazerExclusao} title={`Desfazer exclusão de ${nomeExibido}`}>
            Desfazer
          </button>
        ) : (
          <button type="button" className="btn-icone btn-icone-perigo" onClick={props.onMarcarExclusao} title={`Excluir ${nomeExibido}`} aria-label={`Excluir ${nomeExibido}`}>
            <IconeFuncao funcao="excluir" />
          </button>
        ))}
    </li>
  );
}

/** Gerenciar as classificações dos itens: criar, renomear, reordenar e excluir (Padrão C da skill padrao-ps). */
export function ClassificacoesModal({ categorias, itens, onFechar }: { categorias: CategoriaStorage[]; itens: ItemStorage[]; onFechar: () => void }) {
  const { confirmar, pedirTexto } = useDialogos();
  const { mostrarToast } = useToast();
  const criar = useCriarCategoriaStorage();
  const aplicar = useAplicarEdicaoCategoriasStorage();

  const [modoEdicao, setModoEdicao] = useState(false);
  const [ordemLocal, setOrdemLocal] = useState<string[] | null>(null);
  const [exclusoes, setExclusoes] = useState<Set<string>>(new Set());
  const [renomeacoes, setRenomeacoes] = useState<Map<string, string>>(new Map());
  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [rascunho, setRascunho] = useState('');
  const [salvando, setSalvando] = useState(false);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));
  const porId = useMemo(() => new Map(categorias.map((c) => [c.id, c])), [categorias]);
  const contagem = useMemo(() => contarItensPorCategoria(itens), [itens]);
  const idsBase = useMemo(() => categorias.map((c) => c.id), [categorias]);
  const ids = ordemLocal ?? idsBase;
  const ordemMudou = ordemLocal !== null && ordemLocal.join('|') !== idsBase.join('|');
  const temPendencias = ordemMudou || exclusoes.size > 0 || renomeacoes.size > 0;

  function nomeAtual(c: CategoriaStorage): string {
    return renomeacoes.get(c.id) ?? c.nome;
  }

  /** Lista com os nomes como ficariam depois de salvar, pra checar duplicidade contra renomeações pendentes. */
  function categoriasComNomesPendentes(): CategoriaStorage[] {
    return categorias.filter((c) => !exclusoes.has(c.id)).map((c) => ({ ...c, nome: nomeAtual(c) }));
  }

  async function nova() {
    const nome = await pedirTexto({ titulo: 'Nova classificação', mensagem: 'Nome da classificação', confirmarRotulo: 'Criar' });
    if (!nome?.trim()) return;
    if (nomeDeCategoriaDuplicado(nome, categoriasComNomesPendentes())) {
      mostrarToast(MENSAGEM_NOME_DUPLICADO, 'erro');
      return;
    }
    try {
      await criar.mutateAsync({ nome: nome.trim(), ordem: categorias.reduce((maior, c) => Math.max(maior, c.ordem), 0) + 1 });
      mostrarToast('Classificação criada.');
    } catch (err) {
      mostrarToast(mensagemDeErro(err), 'erro');
    }
  }

  function cancelarRenomear() {
    setEditandoId(null);
    setRascunho('');
  }

  function confirmarRenomear(c: CategoriaStorage) {
    const novo = rascunho.trim();
    if (!novo || novo === nomeAtual(c)) {
      cancelarRenomear();
      return;
    }
    if (nomeDeCategoriaDuplicado(novo, categoriasComNomesPendentes(), c.id)) {
      mostrarToast(MENSAGEM_NOME_DUPLICADO, 'erro');
      return;
    }
    cancelarRenomear();
    setRenomeacoes((atual) => {
      const mapa = new Map(atual);
      if (novo === c.nome) mapa.delete(c.id);
      else mapa.set(c.id, novo);
      return mapa;
    });
  }

  function alternarExclusao(id: string, marcar: boolean) {
    setExclusoes((atual) => {
      const novo = new Set(atual);
      if (marcar) novo.add(id);
      else novo.delete(id);
      return novo;
    });
  }

  function sairModoEdicao() {
    setModoEdicao(false);
    setOrdemLocal(null);
    setExclusoes(new Set());
    setRenomeacoes(new Map());
    cancelarRenomear();
  }

  function aoSoltar({ active, over }: DragEndEvent) {
    if (!over || active.id === over.id) return;
    setOrdemLocal(moverCategoria(ids, String(active.id), String(over.id)));
  }

  async function salvar() {
    if (!temPendencias) return;
    if (exclusoes.size > 0) {
      const afetados = [...exclusoes].reduce((soma, id) => soma + (contagem.get(id) ?? 0), 0);
      const ok = await confirmar({
        titulo: `Excluir ${exclusoes.size} classificação(ões)?`,
        mensagem: `${afetados} item(ns) vão ficar sem classificação. Nada mais será apagado. Essa ação não pode ser desfeita.`,
        confirmarRotulo: 'Excluir e salvar',
        perigoso: true,
      });
      if (!ok) return;
    }
    setSalvando(true);
    try {
      await aplicar.mutateAsync({
        ordens: ordemMudou ? ids.map((id, i) => ({ id, ordem: i + 1 })) : [],
        renomeacoes: [...renomeacoes].map(([id, nome]) => ({ id, nome })),
        exclusoes: [...exclusoes],
      });
      mostrarToast('Alterações salvas.');
      sairModoEdicao();
    } catch (err) {
      mostrarToast(mensagemDeErro(err), 'erro');
    } finally {
      setSalvando(false);
    }
  }

  async function fechar() {
    if (temPendencias) {
      const ok = await confirmar({ titulo: 'Descartar as alterações?', mensagem: 'O que você mudou não será salvo.', confirmarRotulo: 'Descartar', perigoso: true });
      if (!ok) return;
    }
    onFechar();
  }

  return (
    <ModalBase aberto rotulo="Classificações dos itens" onFechar={fechar} classe="modal-edicao modal-storage">
      <h3 className="modal-titulo">Classificações</h3>
      <div className="documentos-busca-linha">
        <button type="button" onClick={nova} disabled={modoEdicao}>
          + Classificação
        </button>
        <span className="storage-espaco" />
        <button
          type="button"
          className={`btn-icone${modoEdicao ? ' documentos-modo-ativo' : ''}`}
          onClick={() => (modoEdicao ? sairModoEdicao() : setModoEdicao(true))}
          title={modoEdicao ? 'Sair do modo de edição' : 'Editar (renomear, arrastar, excluir)'}
          aria-label={modoEdicao ? 'Sair do modo de edição' : 'Entrar no modo de edição'}
        >
          <IconeFuncao funcao="editar" />
        </button>
        <button type="button" className="btn-icone" onClick={salvar} disabled={!modoEdicao || !temPendencias || salvando} title="Salvar alterações" aria-label="Salvar alterações">
          <IconeFuncao funcao="salvar" />
        </button>
      </div>

      {categorias.length === 0 ? (
        <p className="documentos-vazio">Nenhuma classificação ainda.</p>
      ) : (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={aoSoltar}>
          <SortableContext items={ids} strategy={verticalListSortingStrategy}>
            <ul className="storage-lista-classificacoes">
              {ids.map((id) => {
                const c = porId.get(id);
                if (!c) return null;
                return (
                  <LinhaClassificacao
                    key={id}
                    categoria={c}
                    nomeExibido={nomeAtual(c)}
                    quantidade={contagem.get(id) ?? 0}
                    modoEdicao={modoEdicao}
                    renomeada={renomeacoes.has(id)}
                    pendente={exclusoes.has(id)}
                    editando={editandoId === id}
                    rascunho={rascunho}
                    onRascunhoChange={setRascunho}
                    onIniciarRenomear={() => {
                      setEditandoId(id);
                      setRascunho(nomeAtual(c));
                    }}
                    onConfirmarRenomear={() => confirmarRenomear(c)}
                    onCancelarRenomear={cancelarRenomear}
                    onMarcarExclusao={() => alternarExclusao(id, true)}
                    onDesfazerExclusao={() => alternarExclusao(id, false)}
                  />
                );
              })}
            </ul>
          </SortableContext>
        </DndContext>
      )}

      <div className="modal-acoes">
        <button type="button" onClick={fechar}>
          Fechar
        </button>
      </div>
    </ModalBase>
  );
}
