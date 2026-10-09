import type { ReactNode } from 'react';
import type { FuncaoIcone } from '../lib/iconesFuncoes';

/**
 * Substitutos provisórios: SVGs inline para ícones que ainda não existem no
 * bucket `icones`. Cada um tem a linha correspondente em ICONES_PENDENTES.md.
 * Quando o arquivo for enviado ao bucket, trocar o uso e apagar daqui.
 */
function Svg({ tamanho, children }: { tamanho: number; children: ReactNode }) {
  return (
    <svg
      className="icone-provisorio"
      width={tamanho}
      height={tamanho}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {children}
    </svg>
  );
}

interface Props {
  tamanho?: number;
}

// PROVISORIO: trocar por plus.svg
export function IconeMais({ tamanho = 16 }: Props) {
  return (
    <Svg tamanho={tamanho}>
      <path d="M12 5v14" />
      <path d="M5 12h14" />
    </Svg>
  );
}

// PROVISORIO: trocar por grip.svg
export function IconeGrip({ tamanho = 16 }: Props) {
  return (
    <Svg tamanho={tamanho}>
      <path d="M3 6h18" />
      <path d="M3 12h18" />
      <path d="M3 18h18" />
    </Svg>
  );
}

// PROVISORIO: trocar por check.svg
export function IconeCheck({ tamanho = 16 }: Props) {
  return (
    <Svg tamanho={tamanho}>
      <path d="M5 12.5l4.5 4.5L19 7.5" />
    </Svg>
  );
}

// PROVISORIO: trocar por x.svg
export function IconeX({ tamanho = 16 }: Props) {
  return (
    <Svg tamanho={tamanho}>
      <path d="M18 6L6 18" />
      <path d="M6 6l12 12" />
    </Svg>
  );
}

// PROVISORIO: trocar por copy.svg
export function IconeCopiar({ tamanho = 16 }: Props) {
  return (
    <Svg tamanho={tamanho}>
      <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
    </Svg>
  );
}

// PROVISORIO: trocar por refresh.svg
export function IconeAtualizar({ tamanho = 16 }: Props) {
  return (
    <Svg tamanho={tamanho}>
      <path d="M21 12a9 9 0 1 1-2.64-6.36" />
      <path d="M21 4v5h-5" />
    </Svg>
  );
}

// PROVISORIO: trocar por select.svg
export function IconeSelecionar({ tamanho = 16 }: Props) {
  return (
    <Svg tamanho={tamanho}>
      <rect x="4" y="4" width="16" height="16" rx="3" />
      <path d="M8.5 12.5l2.5 2.5 4.5-5" />
    </Svg>
  );
}

// PROVISORIO: trocar por export.svg
export function IconeExportar({ tamanho = 16 }: Props) {
  return (
    <Svg tamanho={tamanho}>
      <path d="M12 3v12" />
      <path d="M7 10l5 5 5-5" />
      <path d="M5 21h14" />
    </Svg>
  );
}

// PROVISORIO: trocar por gear.svg
export function IconeEngrenagem({ tamanho = 16 }: Props) {
  return (
    <Svg tamanho={tamanho}>
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </Svg>
  );
}

// PROVISORIO: trocar por chevron-right.svg (e chevron-down.svg quando aberto)
export function IconeChevron({ tamanho = 14, aberto = false }: Props & { aberto?: boolean }) {
  return (
    <span className={`icone-chevron${aberto ? ' icone-chevron-aberto' : ''}`}>
      <Svg tamanho={tamanho}>
        <polyline points="9 18 15 12 9 6" />
      </Svg>
    </span>
  );
}

// PROVISORIO: trocar por sol.svg
export function IconeSol({ tamanho = 16 }: Props) {
  return (
    <Svg tamanho={tamanho}>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
    </Svg>
  );
}

// PROVISORIO: trocar por lua.svg
export function IconeLua({ tamanho = 16 }: Props) {
  return (
    <Svg tamanho={tamanho}>
      <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" />
    </Svg>
  );
}

// PROVISORIO: trocar por monitor.svg
export function IconeMonitor({ tamanho = 16 }: Props) {
  return (
    <Svg tamanho={tamanho}>
      <rect x="3" y="4" width="18" height="12" rx="2" />
      <path d="M8 20h8M12 16v4" />
    </Svg>
  );
}

/** Substituto de cada função ainda sem arquivo no bucket. */
export const PROVISORIOS_FUNCAO: Partial<Record<FuncaoIcone, (props: Props) => ReactNode>> = {
  adicionar: IconeMais,
  mover: IconeGrip,
  copiar: IconeCopiar,
  fechar: IconeX,
  confirmar: IconeCheck,
  atualizar: IconeAtualizar,
  selecionar: IconeSelecionar,
  exportar: IconeExportar,
};
