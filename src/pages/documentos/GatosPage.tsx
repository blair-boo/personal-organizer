import { useEffect, useState, type FormEvent, type KeyboardEvent } from 'react';
import { DndContext, PointerSensor, closestCenter, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core';
import { SortableContext, arrayMove, horizontalListSortingStrategy, useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { BotaoSalvarModal, ModalBase } from '../../components/ModalBase';
import { IconeFuncao } from '../../components/IconeUso';
import { useDialogos } from '../../components/Dialogo';
import { useToast } from '../../components/Toast';
import { hojeIso } from '../../lib/datas';
import { mensagemDeErro } from '../../lib/erros';
import { textoDeDias } from '../../lib/gatos';
import { useAtualizarGato, useCriarGato, useExcluirGato, useGatos, useReordenarGatos } from '../../hooks/useGatos';
import { useProximasDatasGatos } from '../../hooks/useProximasDatasGatos';
import { formatarData } from '../../lib/datas';
import type { Gato } from '../../types';
import { FichaGato } from './FichaGato';

function NovoGatoModal({ onCriar, onFechar }: { onCriar: (nome: string, nascimento: string | null) => Promise<void>; onFechar: () => void }) {
  const [nome, setNome] = useState('');
  const [nascimento, setNascimento] = useState('');
  const [salvando, setSalvando] = useState(false);

  async function aoEnviar(e: FormEvent) {
    e.preventDefault();
    if (!nome.trim()) return;
    setSalvando(true);
    try {
      await onCriar(nome.trim(), nascimento || null);
    } finally {
      setSalvando(false);
    }
  }

  return (
    <ModalBase aberto rotulo="Novo gato" onFechar={onFechar} classe="modal-edicao" titulo="Novo gato" rodape={
        <>
          <BotaoSalvarModal form="form-modal" disabled={!nome.trim()} salvando={salvando} />
        </>
      }>
      <form id="form-modal" onSubmit={aoEnviar}>
        <label>
          Nome
          <input type="text" value={nome} onChange={(e) => setNome(e.target.value)} data-autofocus required />
        </label>
        <label>
          Data de nascimento (opcional)
          <input type="date" value={nascimento} max={hojeIso()} onChange={(e) => setNascimento(e.target.value)} />
        </label>
      </form>
    </ModalBase>
  );
}

/** Próximas vacinas e vermífugos de todos os gatos, em ordem; as vencidas e as que vencem em até 30 dias ficam em destaque. */
function ProximasDatas({ onSelecionar }: { onSelecionar: (gatoId: string) => void }) {
  const proximas = useProximasDatasGatos();
  if (proximas.length === 0) return null;
  return (
    <div className="documentos-resumo-vencimentos">
      <h3>Próximas vacinas e vermífugos</h3>
      <ul>
        {proximas.map((p) => (
          <li key={`${p.gatoId}-${p.tipo}-${p.titulo}`}>
            <button type="button" className={`documentos-resumo-item${p.vencida ? ' gatos-proxima-vencida' : p.emBreve ? ' gatos-proxima-breve' : ''}`} onClick={() => onSelecionar(p.gatoId)}>
              {p.gatoNome}: {p.titulo} em {formatarData(p.data)} ({textoDeDias(p.dias)}){p.vencida ? ' · atrasada' : ''}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

function AbaDoGato({ gato, nomeExibido, excluido, renomeado, editando, rascunho, ativo, onSelecionar, onIniciarRenomear, onRascunho, onConfirmar, onCancelar, onExcluir, onDesfazerExclusao }: {
  gato: Gato;
  /** Nome com a renomeação pendente aplicada. */
  nomeExibido: string;
  /** Marcado para excluir ao salvar. */
  excluido: boolean;
  renomeado: boolean;
  editando: boolean;
  rascunho: string | null;
  ativo: boolean;
  onSelecionar: () => void;
  onIniciarRenomear: () => void;
  onRascunho: (v: string) => void;
  onConfirmar: () => void;
  onCancelar: () => void;
  onExcluir: () => void;
  onDesfazerExclusao: () => void;
}) {
  const sortable = useSortable({ id: gato.id, disabled: !editando });
  const style = { transform: CSS.Transform.toString(sortable.transform), transition: sortable.transition };

  function aoTeclar(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') {
      e.preventDefault();
      onConfirmar();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      onCancelar();
    }
  }

  if (!editando) {
    return (
      <button ref={sortable.setNodeRef} style={style} type="button" className={ativo ? 'active' : ''} onClick={onSelecionar}>
        {nomeExibido}
      </button>
    );
  }
  return (
    <span ref={sortable.setNodeRef} style={style} className={`documentos-pessoa-editando${excluido ? ' documentos-item-pendente' : ''}${renomeado ? ' documentos-item-renomeado' : ''}`}>
      {!excluido && (
        <button type="button" className="btn-icone documentos-arrastar" title={`Arrastar ${nomeExibido}`} aria-label={`Arrastar ${nomeExibido}`} {...sortable.attributes} {...sortable.listeners}>
          <IconeFuncao funcao="mover" />
        </button>
      )}
      {rascunho !== null ? (
        <input value={rascunho} onChange={(e) => onRascunho(e.target.value)} onKeyDown={aoTeclar} autoFocus aria-label={`Renomear ${nomeExibido}`} />
      ) : (
        <button type="button" onClick={onIniciarRenomear} disabled={excluido} title={`Renomear ${nomeExibido}`} aria-label={`Renomear ${nomeExibido}`}>
          {nomeExibido}
        </button>
      )}
      {excluido ? (
        <button type="button" className="documentos-btn-desfazer" onClick={onDesfazerExclusao} title={`Desfazer exclusão de ${gato.nome}`}>
          Desfazer
        </button>
      ) : (
        <button type="button" className="btn-icone btn-icone-perigo" onClick={onExcluir} title={`Excluir ${nomeExibido}`} aria-label={`Excluir ${nomeExibido}`}>
          <IconeFuncao funcao="excluir" />
        </button>
      )}
    </span>
  );
}

/** Documentos > Gatos: sub-abas por gato. No modo de edição: renomear, reordenar e excluir ficam pendentes até salvar; o + cria na hora. */
export function GatosPage() {
  const { data: gatos, isLoading } = useGatos();
  const criar = useCriarGato();
  const atualizar = useAtualizarGato();
  const reordenar = useReordenarGatos();
  const excluir = useExcluirGato();
  const { confirmar } = useDialogos();
  const { mostrarToast } = useToast();
  const [gatoAtualId, setGatoAtualId] = useState<string | null>(null);
  const [novoAberto, setNovoAberto] = useState(false);
  const [modoEdicao, setModoEdicao] = useState(false);
  const [renomeandoId, setRenomeandoId] = useState<string | null>(null);
  const [rascunho, setRascunho] = useState('');
  const [renomeacoes, setRenomeacoes] = useState<Map<string, string>>(new Map());
  const [exclusoes, setExclusoes] = useState<Set<string>>(new Set());
  const [ordemLocal, setOrdemLocal] = useState<Gato[] | null>(null);
  const [salvando, setSalvando] = useState(false);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  const listaServidor = gatos ?? [];
  const lista = ordemLocal ?? listaServidor;
  const temPendencias = ordemLocal !== null || renomeacoes.size > 0 || exclusoes.size > 0;
  const gatoAtual = listaServidor.find((g) => g.id === gatoAtualId) ?? null;

  useEffect(() => {
    if (listaServidor.length === 0) return;
    if (gatoAtualId && listaServidor.some((g) => g.id === gatoAtualId)) return;
    setGatoAtualId(listaServidor[0].id);
  }, [listaServidor, gatoAtualId]);

  function nomeDe(gato: Gato): string {
    return renomeacoes.get(gato.id) ?? gato.nome;
  }

  function confirmarRenomear(gato: Gato) {
    const novo = rascunho.trim();
    setRenomeandoId(null);
    if (!novo || novo === nomeDe(gato)) return;
    setRenomeacoes((atual) => {
      const mapa = new Map(atual);
      if (novo === gato.nome) mapa.delete(gato.id);
      else mapa.set(gato.id, novo);
      return mapa;
    });
  }

  function marcarExclusao(gato: Gato) {
    setExclusoes((atual) => new Set(atual).add(gato.id));
  }

  function desfazerExclusao(gato: Gato) {
    setExclusoes((atual) => {
      const novo = new Set(atual);
      novo.delete(gato.id);
      return novo;
    });
  }

  function aoSoltar({ active, over }: DragEndEvent) {
    if (!over || active.id === over.id) return;
    const de = lista.findIndex((g) => g.id === active.id);
    const para = lista.findIndex((g) => g.id === over.id);
    if (de < 0 || para < 0) return;
    setOrdemLocal(arrayMove(lista, de, para));
  }

  /** Sai do modo de edição e descarta o que estava pendente. */
  function limparEdicao() {
    setModoEdicao(false);
    setRenomeandoId(null);
    setRenomeacoes(new Map());
    setExclusoes(new Set());
    setOrdemLocal(null);
  }

  async function pedirSairModoEdicao() {
    if (temPendencias) {
      const ok = await confirmar({ titulo: 'Descartar as alterações?', mensagem: 'O que você alterou não será salvo.', confirmarRotulo: 'Descartar', perigoso: true });
      if (!ok) return;
    }
    limparEdicao();
  }

  async function salvarAlteracoes() {
    if (!temPendencias) return;
    if (exclusoes.size > 0) {
      const ok = await confirmar({
        titulo: `Excluir ${exclusoes.size} gato(s)?`,
        mensagem: 'Isso apaga também as vacinas, os vermífugos, as consultas, os exames, os pesos e os documentos desses gatos, com os arquivos. Essa ação não pode ser desfeita.',
        confirmarRotulo: 'Excluir e salvar',
        perigoso: true,
      });
      if (!ok) return;
    }
    setSalvando(true);
    try {
      if (ordemLocal) await reordenar.mutateAsync(ordemLocal.map((g, i) => ({ id: g.id, ordem: i })));
      for (const [id, nome] of renomeacoes) {
        if (exclusoes.has(id)) continue;
        await atualizar.mutateAsync({ id, dados: { nome } });
      }
      for (const id of exclusoes) await excluir.mutateAsync(id);
      mostrarToast('Alterações salvas.');
      limparEdicao();
    } catch (err) {
      mostrarToast(mensagemDeErro(err), 'erro');
    } finally {
      setSalvando(false);
    }
  }

  return (
    <div>
      <ProximasDatas onSelecionar={setGatoAtualId} />
      {isLoading ? (
        <p>Carregando…</p>
      ) : (
        <nav className="app-nav documentos-abas-pessoa">
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={aoSoltar}>
            <SortableContext items={lista.map((g) => g.id)} strategy={horizontalListSortingStrategy}>
              {lista.map((gato) => (
                <AbaDoGato
                  key={gato.id}
                  gato={gato}
                  nomeExibido={nomeDe(gato)}
                  excluido={exclusoes.has(gato.id)}
                  renomeado={renomeacoes.has(gato.id)}
                  editando={modoEdicao}
                  rascunho={renomeandoId === gato.id ? rascunho : null}
                  ativo={gatoAtualId === gato.id}
                  onSelecionar={() => setGatoAtualId(gato.id)}
                  onIniciarRenomear={() => {
                    setRenomeandoId(gato.id);
                    setRascunho(nomeDe(gato));
                  }}
                  onRascunho={setRascunho}
                  onConfirmar={() => confirmarRenomear(gato)}
                  onCancelar={() => setRenomeandoId(null)}
                  onExcluir={() => marcarExclusao(gato)}
                  onDesfazerExclusao={() => desfazerExclusao(gato)}
                />
              ))}
            </SortableContext>
          </DndContext>
          {modoEdicao && (
            <button type="button" className="btn-icone" onClick={() => setNovoAberto(true)} title="Adicionar gato" aria-label="Adicionar gato">
              <IconeFuncao funcao="adicionar" />
            </button>
          )}
          <button
            type="button"
            className={`btn-icone${modoEdicao ? ' documentos-modo-ativo' : ''}`}
            onClick={() => (modoEdicao ? void pedirSairModoEdicao() : setModoEdicao(true))}
            title={modoEdicao ? 'Sair do modo de edição' : 'Editar gatos (renomear, reordenar, excluir)'}
            aria-label={modoEdicao ? 'Sair do modo de edição' : 'Entrar no modo de edição dos gatos'}
          >
            <IconeFuncao funcao="editar" />
          </button>
          {modoEdicao && (
            <button type="button" className="btn-icone" onClick={() => void salvarAlteracoes()} disabled={!temPendencias || salvando} title="Salvar alterações" aria-label="Salvar alterações">
              <IconeFuncao funcao="salvar" />
            </button>
          )}
        </nav>
      )}
      {!isLoading && lista.length === 0 && <p className="documentos-vazio">Nenhum gato cadastrado ainda.</p>}
      {gatoAtual && <FichaGato key={gatoAtual.id} gato={gatoAtual} />}
      {novoAberto && (
        <NovoGatoModal
          onFechar={() => setNovoAberto(false)}
          onCriar={async (nome, nascimento) => {
            try {
              const { gato } = await criar.mutateAsync({ nome, nascimento, ordem: lista.reduce((maior, g) => Math.max(maior, g.ordem), -1) + 1 });
              setGatoAtualId(gato.id);
              setNovoAberto(false);
              mostrarToast('Gato cadastrado.');
            } catch (err) {
              mostrarToast(mensagemDeErro(err), 'erro');
            }
          }}
        />
      )}
    </div>
  );
}
