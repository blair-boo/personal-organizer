import { useEffect, useRef, useState } from 'react';
import iro from '@jaames/iro';
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  arrayMove,
  rectSortingStrategy,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { useToast } from './Toast';
import { IconeFuncao } from './IconeUso';
import { IconeChevron, IconeEngrenagem } from './IconesProvisorios';
import { useCoresUsuario } from '../hooks/useCoresUsuario';
import { APP_CORES } from '../lib/coresApp';
import '../styles/seletor-cor.css';

const COR_INICIAL = '#f3f4f6';

interface SeletorCorProps {
  /** Chamado sempre que a cor muda (hex com #, ex: "#ff0000"). */
  onCorChange: (hex: string) => void;
}

interface SwatchCustom {
  id: string;
  hex: string;
  label: string;
}


function lerCssVar(cssVar: string): string {
  return getComputedStyle(document.documentElement).getPropertyValue(cssVar).trim();
}

/** Seletor de cor pra prévia de fonte/ícones: paleta das cores do app + "Minhas cores", salvas no Supabase (arrastar pra reordenar). */
export function SeletorCor(props: SeletorCorProps) {
  const { mostrarToast } = useToast();
  const [aberto, setAberto] = useState(false);
  const [corHex, setCorHex] = useState(COR_INICIAL);
  const [painelAberto, setPainelAberto] = useState(false);
  const [grupoAppAberto, setGrupoAppAberto] = useState(false);
  const [grupoCustomAberto, setGrupoCustomAberto] = useState(false);
  const { cores: swatchesCustom, salvarLista } = useCoresUsuario();
  const [labelNovo, setLabelNovo] = useState('');
  const [swatchInfo, setSwatchInfo] = useState<{ hex: string; label: string } | null>(null);
  const [editandoLabelId, setEditandoLabelId] = useState<string | null>(null);
  const [labelEditValue, setLabelEditValue] = useState('');
  const [reordenandoCustom, setReordenandoCustom] = useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const pickerContainerRef = useRef<HTMLDivElement>(null);
  const colorPickerRef = useRef<iro.ColorPicker | null>(null);
  const atualizandoRef = useRef(false);

  useEffect(() => {
    const container = pickerContainerRef.current;
    if (!aberto || !container) return;
    if (colorPickerRef.current) return;

    const picker = iro.ColorPicker(container, {
      width: 220,
      color: corHex,
      layout: [{ component: iro.ui.Wheel }, { component: iro.ui.Slider }],
    });

    picker.on('color:change', (color: iro.Color) => {
      if (atualizandoRef.current) return;
      atualizandoRef.current = true;
      setCorHex(color.hexString);
      props.onCorChange(color.hexString);
      setSwatchInfo(null);
      atualizandoRef.current = false;
    });

    colorPickerRef.current = picker;

    return () => {
      container.innerHTML = '';
      colorPickerRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aberto]);

  function aplicarHex(hex: string) {
    if (atualizandoRef.current) return;
    atualizandoRef.current = true;
    setCorHex(hex);
    props.onCorChange(hex);
    if (colorPickerRef.current) {
      colorPickerRef.current.color.hexString = hex;
    }
    atualizandoRef.current = false;
  }

  function onHexInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    const val = e.target.value;
    setCorHex(val);
    setSwatchInfo(null);
    if (/^#[0-9a-fA-F]{6}$/.test(val)) {
      aplicarHex(val);
    }
  }

  function onSwatchClick(hex: string, label: string) {
    aplicarHex(hex);
    setSwatchInfo({ hex, label });
  }

  function salvarSwatches(lista: SwatchCustom[]) {
    salvarLista(lista.map((c, i) => ({ id: c.id, hex: c.hex, label: c.label, ordem: i })));
  }

  function adicionarSwatch() {
    const novo: SwatchCustom = {
      id: crypto.randomUUID(),
      hex: corHex,
      label: labelNovo.trim(),
    };
    salvarSwatches([...swatchesCustom, novo]);
    setLabelNovo('');
  }

  function removerSwatch(id: string) {
    salvarSwatches(swatchesCustom.filter((s) => s.id !== id));
  }

  function adicionarSwatchRapido() {
    const novo: SwatchCustom = { id: crypto.randomUUID(), hex: corHex, label: '' };
    salvarSwatches([...swatchesCustom, novo]);
    mostrarToast('Cor adicionada');
  }

  function iniciarEdicaoLabel(sw: SwatchCustom) {
    setEditandoLabelId(sw.id);
    setLabelEditValue(sw.label);
  }

  function salvarLabel() {
    const id = editandoLabelId;
    if (id) {
      salvarSwatches(swatchesCustom.map((s) => (s.id === id ? { ...s, label: labelEditValue.trim() } : s)));
    }
    setEditandoLabelId(null);
  }

  function cancelarEdicaoLabel() {
    setEditandoLabelId(null);
  }

  function handleDragEndCustom(event: DragEndEvent) {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      const de = swatchesCustom.findIndex((s) => s.id === active.id);
      const para = swatchesCustom.findIndex((s) => s.id === over.id);
      if (de !== -1 && para !== -1) {
        salvarSwatches(arrayMove(swatchesCustom, de, para));
      }
    }
  }

  return (
    <div className="seletor-cor">
      <div className="seletor-cor-linha">
        <button
          type="button"
          className="seletor-cor-trigger"
          style={{ background: corHex }}
          onClick={() => setAberto((v) => !v)}
          title={aberto ? 'Fechar seletor de cor' : 'Abrir seletor de cor'}
          aria-label={aberto ? 'Fechar seletor de cor' : 'Abrir seletor de cor'}
          aria-expanded={aberto}
        />

        <input
          type="text"
          className="seletor-cor-hex-input"
          value={corHex}
          onChange={onHexInputChange}
          maxLength={7}
          spellCheck={false}
          aria-label="Cor em hexadecimal"
        />

        <button
          type="button"
          className="btn-icone seletor-cor-add-rapido"
          onClick={adicionarSwatchRapido}
          title="Adicionar às minhas cores"
          aria-label="Adicionar às minhas cores"
        >
          <IconeFuncao funcao="adicionar" tamanho={14} />
        </button>

        <button
          type="button"
          className="btn-icone seletor-cor-engrenagem"
          onClick={() => {
            setPainelAberto((v) => !v);
            setAberto(false);
          }}
          title="Gerenciar cores"
          aria-label="Gerenciar cores"
          aria-expanded={painelAberto}
        >
          <IconeEngrenagem />
        </button>

        {swatchesCustom.length > 1 && (
          <button
            type="button"
            className="btn-icone seletor-cor-reordenar"
            onClick={() => setReordenandoCustom((v) => !v)}
            title="Reordenar minhas cores"
            aria-label="Reordenar minhas cores"
            aria-pressed={reordenandoCustom}
          >
            <IconeFuncao funcao="mover" />
          </button>
        )}
      </div>

      {swatchInfo && (
        <div className="seletor-cor-swatch-info">
          <span className="seletor-cor-swatch-label">{swatchInfo.label || swatchInfo.hex}</span>
          <button
            type="button"
            className="btn-icone"
            title="Copiar hex"
            aria-label="Copiar hex"
            onClick={() => void navigator.clipboard.writeText(swatchInfo.hex)}
          >
            <IconeFuncao funcao="copiar" tamanho={14} />
          </button>
        </div>
      )}

      <div className="seletor-cor-swatches">
        {APP_CORES.map((ac) => {
          const hex = lerCssVar(ac.cssVar);
          return (
            <button
              key={ac.cssVar}
              type="button"
              className="seletor-cor-swatch seletor-cor-swatch-app"
              style={{ background: hex }}
              onClick={() => onSwatchClick(hex, ac.label)}
              title={ac.label}
            />
          );
        })}
        {reordenandoCustom ? (
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEndCustom}>
            <SortableContext items={swatchesCustom.map((s) => s.id)} strategy={rectSortingStrategy}>
              {swatchesCustom.map((sw) => (
                <SwatchCustomSortable key={sw.id} sw={sw} />
              ))}
            </SortableContext>
          </DndContext>
        ) : (
          swatchesCustom.map((sw) => (
            <button
              key={sw.id}
              type="button"
              className="seletor-cor-swatch seletor-cor-swatch-custom"
              style={{ background: sw.hex }}
              onClick={() => onSwatchClick(sw.hex, sw.label || sw.hex)}
              title={sw.label || sw.hex}
            />
          ))
        )}
      </div>

      {aberto && (
        <div className="seletor-cor-picker-wrap">
          <div ref={pickerContainerRef} />
        </div>
      )}

      {painelAberto && (
        <div className="seletor-cor-painel">
          <div className="seletor-cor-grupo">
            <button
              type="button"
              className="seletor-cor-grupo-header"
              onClick={() => setGrupoAppAberto((v) => !v)}
              aria-expanded={grupoAppAberto}
            >
              <IconeChevron aberto={grupoAppAberto} />
              Cores do app
            </button>
            {grupoAppAberto && (
              <ul className="seletor-cor-grupo-lista">
                {APP_CORES.map((ac) => {
                  const hex = lerCssVar(ac.cssVar);
                  return (
                    <li key={ac.cssVar} className="seletor-cor-painel-item">
                      <span className="seletor-cor-swatch seletor-cor-swatch-app" style={{ background: hex }} />
                      <span className="seletor-cor-painel-hex">{hex}</span>
                      <span className="seletor-cor-painel-label">{ac.label}</span>
                      <button
                        type="button"
                        className="btn-icone"
                        title="Copiar hex"
                        aria-label="Copiar hex"
                        onClick={() => void navigator.clipboard.writeText(hex)}
                      >
                        <IconeFuncao funcao="copiar" tamanho={14} />
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          <div className="seletor-cor-grupo">
            <button
              type="button"
              className="seletor-cor-grupo-header"
              onClick={() => setGrupoCustomAberto((v) => !v)}
              aria-expanded={grupoCustomAberto}
            >
              <IconeChevron aberto={grupoCustomAberto} />
              Minhas cores
            </button>
            {grupoCustomAberto && (
              <>
                <ul className="seletor-cor-grupo-lista">
                  {swatchesCustom.length === 0 && (
                    <li className="seletor-cor-painel-vazio">Nenhuma cor salva ainda.</li>
                  )}
                  {reordenandoCustom ? (
                    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEndCustom}>
                      <SortableContext items={swatchesCustom.map((s) => s.id)} strategy={verticalListSortingStrategy}>
                        {swatchesCustom.map((sw) => (
                          <SwatchPainelSortable key={sw.id} sw={sw} />
                        ))}
                      </SortableContext>
                    </DndContext>
                  ) : (
                    swatchesCustom.map((sw) => (
                      <li key={sw.id} className="seletor-cor-painel-item">
                        <span className="seletor-cor-swatch seletor-cor-swatch-custom" style={{ background: sw.hex }} />
                        <span className="seletor-cor-painel-hex">{sw.hex}</span>
                        {editandoLabelId === sw.id ? (
                          <input
                            type="text"
                            className="seletor-cor-label-edit-input"
                            value={labelEditValue}
                            onChange={(e) => setLabelEditValue(e.target.value)}
                            onBlur={salvarLabel}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') salvarLabel();
                              if (e.key === 'Escape') cancelarEdicaoLabel();
                            }}
                            maxLength={40}
                            autoFocus
                          />
                        ) : (
                          <span
                            className={`seletor-cor-painel-label ${!sw.label ? 'seletor-cor-painel-label-vazio' : ''}`}
                            onClick={() => iniciarEdicaoLabel(sw)}
                          >
                            {sw.label || sw.hex}
                          </span>
                        )}
                        <button
                          type="button"
                          className="btn-icone"
                          title="Copiar hex"
                          aria-label="Copiar hex"
                          onClick={() => void navigator.clipboard.writeText(sw.hex)}
                        >
                          <IconeFuncao funcao="copiar" tamanho={14} />
                        </button>
                        <button
                          type="button"
                          className="btn-icone btn-icone-perigo"
                          title="Remover"
                          aria-label="Remover"
                          onClick={() => removerSwatch(sw.id)}
                        >
                          <IconeFuncao funcao="fechar" tamanho={14} />
                        </button>
                      </li>
                    ))
                  )}
                </ul>

                <div className="seletor-cor-adicionar">
                  <span className="seletor-cor-swatch" style={{ background: corHex }} />
                  <span className="seletor-cor-adicionar-hex">{corHex}</span>
                  <input
                    type="text"
                    className="seletor-cor-adicionar-label"
                    placeholder="Nome (opcional)"
                    value={labelNovo}
                    onChange={(e) => setLabelNovo(e.target.value)}
                    maxLength={40}
                  />
                  <button type="button" onClick={adicionarSwatch}>
                    Adicionar
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

/** Swatch custom na fileira principal, em modo de reordenação. */
function SwatchCustomSortable({ sw }: { sw: SwatchCustom }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: sw.id });
  const style = { background: sw.hex, transform: CSS.Transform.toString(transform), transition };

  return (
    <button
      ref={setNodeRef}
      type="button"
      className={`seletor-cor-swatch seletor-cor-swatch-custom ${isDragging ? 'arrastando' : ''}`}
      style={style}
      title={sw.label || sw.hex}
      {...attributes}
      {...listeners}
    />
  );
}

/** Item do painel "Minhas cores", em modo de reordenação: só alça + hex + label. */
function SwatchPainelSortable({ sw }: { sw: SwatchCustom }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: sw.id });
  const style = { transform: CSS.Transform.toString(transform), transition };

  return (
    <li ref={setNodeRef} style={style} className={`seletor-cor-painel-item ${isDragging ? 'arrastando' : ''}`}>
      <span className="seletor-cor-painel-handle" {...attributes} {...listeners} aria-label="Arrastar para reordenar">
        <IconeFuncao funcao="mover" />
      </span>
      <span className="seletor-cor-swatch seletor-cor-swatch-custom" style={{ background: sw.hex }} />
      <span className="seletor-cor-painel-hex">{sw.hex}</span>
      <span className={`seletor-cor-painel-label ${!sw.label ? 'seletor-cor-painel-label-vazio' : ''}`}>
        {sw.label || sw.hex}
      </span>
    </li>
  );
}
