import { useState } from 'react';
import { useLocation } from 'react-router-dom';
import { DndContext, KeyboardSensor, PointerSensor, closestCenter, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core';
import { SortableContext, arrayMove, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { useAbasDoGrupo, useAbasEdicao } from './AbasEdicao';
import { IconeFuncao, IconeUso } from './IconeUso';
import { ModalIcone } from './ModalIcone';
import { useIconesUsos } from '../hooks/useIconesUsos';
import { useTemaEfetivo } from '../hooks/useTema';
import { ROTULOS_GRUPOS, type GrupoAbas } from '../lib/abas';
import { resolverUso } from '../lib/iconesUsos';
import type { UsoIcone } from '../types';

function grupoDaRota(caminho: string): GrupoAbas | null {
  for (const g of ['financas', 'apartamento', 'documentos', 'settings'] as const) {
    if (caminho === `/${g}` || caminho.startsWith(`/${g}/`)) return g;
  }
  return null;
}

/**
 * Painel do modo de edição de abas: nome, ícone e ordem das abas principais e das
 * sub-abas da seção em que você está. A navegação continua funcionando para trocar de seção.
 */
export function PainelEdicaoAbas() {
  const { pathname } = useLocation();
  const grupoAtual = grupoDaRota(pathname);
  return (
    <section className="painel-abas" aria-label="Edição de abas">
      <p className="painel-abas-dica">
        Edite nome, ícone e ordem. Navegue pelas abas para editar as de outras seções. Nome em branco só vale se houver ícone.
      </p>
      <GrupoEditavel grupo="principal" />
      {grupoAtual && <GrupoEditavel grupo={grupoAtual} />}
    </section>
  );
}

function GrupoEditavel({ grupo }: { grupo: GrupoAbas }) {
  const abas = useAbasDoGrupo(grupo);
  const edicao = useAbasEdicao();
  const { data: usos = [] } = useIconesUsos();
  const tema = useTemaEfetivo();
  const [alvo, setAlvo] = useState<{ chave: string; rotulo: string } | null>(null);
  const sensores = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  function aoSoltar(e: DragEndEvent) {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    const chaves = abas.map((a) => a.chave);
    const de = chaves.indexOf(String(active.id));
    const para = chaves.indexOf(String(over.id));
    if (de < 0 || para < 0) return;
    edicao.setOrdem(grupo, arrayMove(chaves, de, para));
  }

  function usoAtual(chave: string): UsoIcone | null {
    const rascunho = edicao.usoRascunho(chave);
    return rascunho !== undefined ? rascunho : resolverUso(usos, 'aba', chave, tema);
  }

  return (
    <div className="painel-abas-grupo">
      <h2>{ROTULOS_GRUPOS[grupo]}</h2>
      <DndContext sensors={sensores} collisionDetection={closestCenter} onDragEnd={aoSoltar}>
        <SortableContext items={abas.map((a) => a.chave)} strategy={verticalListSortingStrategy}>
          <ul className="painel-abas-lista">
            {abas.map((aba) => (
              <LinhaAba
                key={aba.chave}
                chave={aba.chave}
                rotulo={aba.rotulo}
                nome={aba.nome}
                semIconeNemNome={aba.nome.trim() === '' && usoAtual(aba.chave) === null}
                onNome={(nome) => edicao.setNome(aba.chave, nome)}
                onIcone={() => setAlvo({ chave: aba.chave, rotulo: aba.rotulo })}
              />
            ))}
          </ul>
        </SortableContext>
      </DndContext>
      {alvo && (
        <ModalIcone
          aberto
          rotuloAlvo={alvo.rotulo}
          alvoTipo="aba"
          alvoId={alvo.chave}
          inicial={usoAtual(alvo.chave)}
          tamanhoBase={16}
          permiteRemover
          onConfirmar={(uso) => {
            edicao.setUso(alvo.chave, uso);
            setAlvo(null);
          }}
          onRemover={() => {
            edicao.setUso(alvo.chave, null);
            setAlvo(null);
          }}
          onFechar={() => setAlvo(null)}
        />
      )}
    </div>
  );
}

function LinhaAba({
  chave,
  rotulo,
  nome,
  semIconeNemNome,
  onNome,
  onIcone,
}: {
  chave: string;
  rotulo: string;
  nome: string;
  semIconeNemNome: boolean;
  onNome: (nome: string) => void;
  onIcone: () => void;
}) {
  const sortable = useSortable({ id: chave });
  const style = { transform: CSS.Transform.toString(sortable.transform), transition: sortable.transition };
  return (
    <li ref={sortable.setNodeRef} style={style} className="painel-abas-linha">
      <button type="button" className="btn-icone categorias-arrastar" title={`Mover ${rotulo}`} aria-label={`Mover ${rotulo}`} {...sortable.attributes} {...sortable.listeners}>
        <IconeFuncao funcao="mover" />
      </button>
      <IconeUso alvoTipo="aba" alvoId={chave} rotulo={rotulo} tamanhoBase={18} modoEdicao onEditar={onIcone} />
      <input
        type="text"
        className={`painel-abas-nome${semIconeNemNome ? ' painel-abas-nome-invalido' : ''}`}
        value={nome}
        onChange={(e) => onNome(e.target.value)}
        placeholder={rotulo}
        aria-label={`Nome da aba ${rotulo}`}
        aria-invalid={semIconeNemNome}
      />
    </li>
  );
}
