import { useEffect, useState, type FormEvent, type KeyboardEvent } from 'react';
import { DndContext, PointerSensor, closestCenter, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core';
import { SortableContext, arrayMove, horizontalListSortingStrategy, useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { ModalBase } from '../../components/ModalBase';
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
    <ModalBase aberto rotulo="Novo gato" onFechar={onFechar} classe="modal-edicao">
      <h3 className="modal-titulo">Novo gato</h3>
      <form onSubmit={aoEnviar}>
        <label>
          Nome
          <input type="text" value={nome} onChange={(e) => setNome(e.target.value)} data-autofocus required />
        </label>
        <label>
          Data de nascimento (opcional)
          <input type="date" value={nascimento} max={hojeIso()} onChange={(e) => setNascimento(e.target.value)} />
        </label>
        <div className="modal-acoes">
          <button type="submit" disabled={!nome.trim() || salvando}>
            {salvando ? 'Salvando…' : 'Salvar'}
          </button>
          <button type="button" onClick={onFechar}>
            Cancelar
          </button>
        </div>
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

function AbaDoGato({ gato, editando, rascunho, ativo, onSelecionar, onIniciarRenomear, onRascunho, onConfirmar, onCancelar, onExcluir }: {
  gato: Gato;
  editando: boolean;
  rascunho: string | null;
  ativo: boolean;
  onSelecionar: () => void;
  onIniciarRenomear: () => void;
  onRascunho: (v: string) => void;
  onConfirmar: () => void;
  onCancelar: () => void;
  onExcluir: () => void;
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
        {gato.nome}
      </button>
    );
  }
  return (
    <span ref={sortable.setNodeRef} style={style} className="documentos-pessoa-editando">
      <button type="button" className="btn-icone documentos-arrastar" title={`Arrastar ${gato.nome}`} aria-label={`Arrastar ${gato.nome}`} {...sortable.attributes} {...sortable.listeners}>
        <IconeFuncao funcao="mover" />
      </button>
      {rascunho !== null ? (
        <input value={rascunho} onChange={(e) => onRascunho(e.target.value)} onKeyDown={aoTeclar} autoFocus aria-label={`Renomear ${gato.nome}`} />
      ) : (
        <button type="button" onClick={onIniciarRenomear} title={`Renomear ${gato.nome}`} aria-label={`Renomear ${gato.nome}`}>
          {gato.nome}
        </button>
      )}
      <button type="button" className="btn-icone btn-icone-perigo" onClick={onExcluir} title={`Excluir ${gato.nome}`} aria-label={`Excluir ${gato.nome}`}>
        <IconeFuncao funcao="excluir" />
      </button>
    </span>
  );
}

/** Documentos > Gatos: sub-abas por gato, com o modo de edição (vassoura) para renomear, reordenar e excluir. */
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
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  const lista = gatos ?? [];
  const gatoAtual = lista.find((g) => g.id === gatoAtualId) ?? null;

  useEffect(() => {
    if (lista.length === 0) return;
    if (gatoAtualId && lista.some((g) => g.id === gatoAtualId)) return;
    setGatoAtualId(lista[0].id);
  }, [lista, gatoAtualId]);

  async function executar(acao: () => Promise<unknown>, sucesso?: string) {
    try {
      await acao();
      if (sucesso) mostrarToast(sucesso);
    } catch (err) {
      mostrarToast(mensagemDeErro(err), 'erro');
    }
  }

  async function confirmarRenomear(gato: Gato) {
    const novo = rascunho.trim();
    setRenomeandoId(null);
    if (!novo || novo === gato.nome) return;
    await executar(() => atualizar.mutateAsync({ id: gato.id, dados: { nome: novo } }));
  }

  async function aoExcluir(gato: Gato) {
    const ok = await confirmar({
      titulo: `Excluir ${gato.nome}?`,
      mensagem: `Isso apaga também as vacinas, os vermífugos, as consultas, os exames, os pesos e os documentos de ${gato.nome}, com os arquivos. Essa ação não pode ser desfeita.`,
      confirmarRotulo: 'Excluir',
      perigoso: true,
    });
    if (!ok) return;
    await executar(() => excluir.mutateAsync(gato.id), 'Gato excluído.');
  }

  function aoSoltar({ active, over }: DragEndEvent) {
    if (!over || active.id === over.id) return;
    const de = lista.findIndex((g) => g.id === active.id);
    const para = lista.findIndex((g) => g.id === over.id);
    if (de < 0 || para < 0) return;
    void executar(() => reordenar.mutateAsync(arrayMove(lista, de, para).map((g, i) => ({ id: g.id, ordem: i }))));
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
                  editando={modoEdicao}
                  rascunho={renomeandoId === gato.id ? rascunho : null}
                  ativo={gatoAtualId === gato.id}
                  onSelecionar={() => setGatoAtualId(gato.id)}
                  onIniciarRenomear={() => {
                    setRenomeandoId(gato.id);
                    setRascunho(gato.nome);
                  }}
                  onRascunho={setRascunho}
                  onConfirmar={() => void confirmarRenomear(gato)}
                  onCancelar={() => setRenomeandoId(null)}
                  onExcluir={() => void aoExcluir(gato)}
                />
              ))}
            </SortableContext>
          </DndContext>
          <button type="button" onClick={() => setNovoAberto(true)} disabled={modoEdicao}>
            + Gato
          </button>
          <button
            type="button"
            className={`btn-icone${modoEdicao ? ' documentos-modo-ativo' : ''}`}
            onClick={() => {
              setModoEdicao((v) => !v);
              setRenomeandoId(null);
            }}
            title={modoEdicao ? 'Sair do modo de edição' : 'Editar gatos (renomear, reordenar, excluir)'}
            aria-label={modoEdicao ? 'Sair do modo de edição' : 'Entrar no modo de edição dos gatos'}
          >
            <IconeFuncao funcao="editar" />
          </button>
        </nav>
      )}
      {!isLoading && lista.length === 0 && <p className="documentos-vazio">Nenhum gato cadastrado ainda.</p>}
      {gatoAtual && <FichaGato key={gatoAtual.id} gato={gatoAtual} />}
      {novoAberto && (
        <NovoGatoModal
          onFechar={() => setNovoAberto(false)}
          onCriar={async (nome, nascimento) => {
            try {
              const gato = await criar.mutateAsync({ nome, nascimento, ordem: lista.reduce((maior, g) => Math.max(maior, g.ordem), -1) + 1 });
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
