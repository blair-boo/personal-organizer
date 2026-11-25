import { useEffect, useRef, useState, type ReactNode, type RefObject } from 'react';
import { useDialogos } from './Dialogo';
import { IconeFuncao } from './IconeUso';

interface ModalBaseProps {
  aberto: boolean;
  /** Rótulo acessível do diálogo. */
  rotulo: string;
  /** Chamado pelo X, pelo Esc e pelo clique no backdrop. */
  onFechar: () => void;
  /** Classe extra no .modal (ex.: 'modal-edicao'). */
  classe?: string;
  /**
   * Título fixo no cabeçalho, com o X (vermelho) à direita. Quando informado, o modal usa a
   * estrutura padrão: cabeçalho e rodapé ficam parados e só o corpo rola.
   */
  titulo?: ReactNode;
  /** Ações fixas no rodapé (normalmente só o BotaoSalvarModal, à direita). Só vale com `titulo`. */
  rodape?: ReactNode;
  /**
   * Fechar um modal com `titulo` depois de ter mexido em algum campo pergunta "Descartar as
   * alterações?". Passe false quando o modal só mostra ou filtra dados, ou já tem a própria pergunta.
   */
  perguntarAoDescartar?: boolean;
  children: ReactNode;
}

/** Foco inicial + trap de Tab dentro do diálogo enquanto aberto. */
export function useFocoPreso(aberto: boolean, ref: RefObject<HTMLDivElement | null>) {
  useEffect(() => {
    if (!aberto) return;
    const el = ref.current;
    if (!el) return;

    const focaveis = () =>
      Array.from(el.querySelectorAll<HTMLElement>('button, input, textarea, select, [tabindex]')).filter(
        (f) => !f.hasAttribute('disabled')
      );

    (el.querySelector<HTMLElement>('[data-autofocus]') ?? focaveis()[0])?.focus();

    function onKeyDown(e: KeyboardEvent) {
      if (e.key !== 'Tab') return;
      const lista = focaveis();
      if (lista.length === 0) return;
      const primeiro = lista[0];
      const ultimo = lista[lista.length - 1];
      if (e.shiftKey && document.activeElement === primeiro) {
        e.preventDefault();
        ultimo.focus();
      } else if (!e.shiftKey && document.activeElement === ultimo) {
        e.preventDefault();
        primeiro.focus();
      }
    }

    el.addEventListener('keydown', onKeyDown);
    return () => el.removeEventListener('keydown', onKeyDown);
  }, [aberto, ref]);
}

/**
 * Estrutura comum de todos os modais do app. Com `titulo`, é o padrão: cabeçalho fixo com o X
 * vermelho, corpo que rola e rodapé fixo (`rodape`). Sem `titulo`, é a caixa simples dos
 * diálogos de confirmação, com o X no canto. X, Esc e clique no backdrop fecham; clique dentro
 * da caixa não fecha. Foco fica preso dentro da caixa (Tab/Shift+Tab).
 */
export function ModalBase({ aberto, rotulo, onFechar, classe, titulo, rodape, perguntarAoDescartar = true, children }: ModalBaseProps) {
  const ref = useRef<HTMLDivElement>(null);
  const { confirmar } = useDialogos();
  const [mexeu, setMexeu] = useState(false);
  useFocoPreso(aberto, ref);

  useEffect(() => {
    if (!aberto) setMexeu(false);
  }, [aberto]);

  if (!aberto) return null;

  async function pedirFechar() {
    if (mexeu && perguntarAoDescartar) {
      const ok = await confirmar({ titulo: 'Descartar as alterações?', mensagem: 'O que você alterou não será salvo.', confirmarRotulo: 'Descartar', perigoso: true });
      if (!ok) return;
    }
    onFechar();
  }

  if (titulo !== undefined) {
    return (
      <div
        className="modal-backdrop"
        onKeyDown={(e) => e.key === 'Escape' && void pedirFechar()}
        onClick={(e) => {
          if (e.target === e.currentTarget) void pedirFechar();
        }}
      >
        <div className="modal-wrap modal-wrap-padrao" ref={ref}>
          <div className={classe ? `modal modal-padrao ${classe}` : 'modal modal-padrao'} role="dialog" aria-modal="true" aria-label={rotulo}>
            <header className="modal-cabecalho">
              <h3 className="modal-titulo">{titulo}</h3>
              <button type="button" className="modal-fechar" onClick={() => void pedirFechar()} title="Fechar" aria-label="Fechar">
                ×
              </button>
            </header>
            <div className="modal-corpo" onInputCapture={() => setMexeu(true)} onChangeCapture={() => setMexeu(true)}>
              {children}
            </div>
            {rodape && <footer className="modal-rodape">{rodape}</footer>}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className="modal-backdrop"
      onKeyDown={(e) => e.key === 'Escape' && onFechar()}
      onClick={(e) => {
        if (e.target === e.currentTarget) onFechar();
      }}
    >
      <div className="modal-wrap" ref={ref}>
        <button type="button" className="modal-fechar" onClick={onFechar} aria-label="Fechar">
          ×
        </button>
        <div className={classe ? `modal ${classe}` : 'modal'} role="dialog" aria-modal="true" aria-label={rotulo}>
          {children}
        </div>
      </div>
    </div>
  );
}

interface BotaoSalvarModalProps {
  /** Salvar por clique. Para salvar por envio de formulário, use `form`. */
  onClick?: () => void;
  /** Id do <form> do corpo do modal: o botão do rodapé o envia (Enter também funciona). */
  form?: string;
  disabled?: boolean;
  salvando?: boolean;
  rotulo?: string;
  /** Ícone da ação: salvar (padrão) ou confirmar, para quem só confirma uma escolha. */
  funcao?: 'salvar' | 'confirmar';
}

/** Salvar do rodapé do modal: só o ícone, sem borda, à direita. */
export function BotaoSalvarModal({ onClick, form, disabled = false, salvando = false, rotulo = 'Salvar', funcao = 'salvar' }: BotaoSalvarModalProps) {
  const texto = salvando ? 'Salvando…' : rotulo;
  return (
    <button type={form ? 'submit' : 'button'} form={form} className="btn-icone modal-btn-salvar" onClick={onClick} disabled={disabled || salvando} title={texto} aria-label={texto}>
      <IconeFuncao funcao={funcao} tamanho={22} />
    </button>
  );
}
