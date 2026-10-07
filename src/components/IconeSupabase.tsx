import { supabase } from '../lib/supabaseClient';

const ICONS_BUCKET = 'icones';

export function urlIconeSupabase(arquivo: string): string {
  // O getPublicUrl já codifica o caminho; codificar antes duplicaria (espaço viraria %2520) e o arquivo daria 400.
  return supabase.storage.from(ICONS_BUCKET).getPublicUrl(arquivo).data.publicUrl;
}

/** Ícone "pintado" via mask: puxa o SVG do bucket `icones` do Supabase Storage e usa currentColor pra seguir a cor do botão/tema (mesma técnica do manga-lists). */
export function IconeSupabase({
  arquivo,
  tamanho = 16,
  cor,
  titulo,
}: {
  arquivo: string;
  tamanho?: number;
  /** Cor CSS (ex.: `var(--accent)` ou `#112233`); sem ela segue currentColor. */
  cor?: string;
  /** Texto ao passar o mouse (nome da função do ícone). */
  titulo?: string;
}) {
  const url = urlIconeSupabase(arquivo);
  return (
    <span
      className="icone-mascarado"
      aria-hidden
      title={titulo}
      style={{
        width: tamanho,
        height: tamanho,
        WebkitMaskImage: `url(${url})`,
        maskImage: `url(${url})`,
        ...(cor ? { backgroundColor: cor } : {}),
      }}
    />
  );
}

/** Ícone ilustrativo colorido (PNG do bucket `icones`), renderizado como imagem normal — sem a máscara de currentColor, que jogaria fora as cores originais. */
export function IconePng({ arquivo, tamanho = 18, titulo }: { arquivo: string; tamanho?: number; titulo?: string }) {
  const url = urlIconeSupabase(arquivo);
  return <img src={url} alt="" aria-hidden title={titulo} className="icone-png" width={tamanho} height={tamanho} />;
}
