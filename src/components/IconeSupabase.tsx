import { supabase } from '../lib/supabaseClient';

const ICONS_BUCKET = 'icones';

export function urlIconeSupabase(arquivo: string): string {
  const caminho = arquivo
    .split('/')
    .map((parte) => encodeURIComponent(parte))
    .join('/');
  return supabase.storage.from(ICONS_BUCKET).getPublicUrl(caminho).data.publicUrl;
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

/** Ícone ilustrativo colorido (PNG do bucket `icones`), renderizado como imagem normal — sem a máscara de currentColor, que jogaria fora as cores originais. */
export function IconePng({ arquivo, tamanho = 18 }: { arquivo: string; tamanho?: number }) {
  const url = urlIconeSupabase(arquivo);
  return <img src={url} alt="" aria-hidden className="icone-png" width={tamanho} height={tamanho} />;
}
