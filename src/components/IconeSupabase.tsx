import { supabase } from '../lib/supabaseClient';

const ICONS_BUCKET = 'icones';

function urlIconeSupabase(arquivo: string): string {
  return supabase.storage.from(ICONS_BUCKET).getPublicUrl(arquivo).data.publicUrl;
}

/** Ícone "pintado" via mask: puxa o SVG do bucket `icones` do Supabase Storage e usa currentColor pra seguir a cor do botão/tema (mesma técnica do manga-lists). */
export function IconeSupabase({ arquivo, tamanho = 16 }: { arquivo: string; tamanho?: number }) {
  const url = urlIconeSupabase(arquivo);
  return (
    <span
      className="icone-mascarado"
      aria-hidden
      style={{
        width: tamanho,
        height: tamanho,
        WebkitMaskImage: `url(${url})`,
        maskImage: `url(${url})`,
      }}
    />
  );
}
