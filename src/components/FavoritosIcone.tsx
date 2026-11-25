import { IconeFuncao } from './IconeUso';

/** Estrela de favoritar um ícone da galeria. Salva na hora. */
export function BotaoFavorito({ favorito, nome, desabilitado = false, onAlternar }: { favorito: boolean; nome: string; desabilitado?: boolean; onAlternar: () => void }) {
  const texto = favorito ? `Tirar ${nome} dos favoritos` : `Favoritar ${nome}`;
  return (
    <button type="button" className={`btn-icone icone-favorito${favorito ? ' ativo' : ''}`} onClick={onAlternar} disabled={desabilitado} aria-pressed={favorito} title={texto} aria-label={texto}>
      <IconeFuncao funcao={favorito ? 'favoritado' : 'favoritar'} tamanho={14} />
    </button>
  );
}

/** Filtro que mostra só os favoritos, de todas as pastas juntas. Translúcido desligado, sólido ligado. */
export function FiltroFavoritos({ ativo, quantidade, onAlternar }: { ativo: boolean; quantidade: number; onAlternar: () => void }) {
  return (
    <button
      type="button"
      className={`btn-icone filtro-favoritos${ativo ? ' ativo' : ''}`}
      onClick={onAlternar}
      aria-pressed={ativo}
      title={ativo ? 'Mostrar todas as pastas' : 'Mostrar só os favoritos'}
      aria-label={ativo ? 'Mostrar todas as pastas' : `Mostrar só os favoritos (${quantidade})`}
    >
      <IconeFuncao funcao={ativo ? 'favoritado' : 'favoritar'} tamanho={20} />
      <span className="filtro-favoritos-contagem">{quantidade}</span>
    </button>
  );
}
