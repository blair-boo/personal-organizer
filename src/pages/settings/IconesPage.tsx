import { useCallback, useRef, useState } from 'react';
import { useIconesTeste } from '../../hooks/useIconesTeste';
import { mensagemDeErro } from '../../lib/erros';
import { SeletorCor } from '../../components/SeletorCor';

const TAMANHO_PADRAO = 16;
const TAMANHO_MIN = 10;
const TAMANHO_MAX = 64;

/**
 * Aba de ícones (Settings): prévia de fonte e dos ícones do bucket `icones`
 * (SVG na raiz, PNG na pasta PNG/) num tamanho ajustável — um controle só,
 * em vez de duplicar blocos fixos por tamanho.
 */
export function IconesPage() {
  const [tamanho, setTamanho] = useState(TAMANHO_PADRAO);
  const { data, isLoading, isFetching, isError, error, refetch } = useIconesTeste();
  const conteudoRef = useRef<HTMLDivElement>(null);

  const icones = data?.svg ?? [];
  const iconesPng = data?.png ?? [];
  const erro = isError ? mensagemDeErro(error) : null;

  // Var própria (não --text-h): setar na .testes-conteudo escopa o efeito só
  // aos textos de exemplo da fonte e aos ícones da seção, sem repintar
  // cabeçalhos, botões e outros ícones da página.
  function aplicarCor(hex: string) {
    conteudoRef.current?.style.setProperty('--testes-cor-preview', hex);
  }

  const recarregar = useCallback(() => {
    void refetch();
  }, [refetch]);

  function ajustarTamanho(valor: number) {
    if (Number.isNaN(valor)) return;
    setTamanho(Math.min(TAMANHO_MAX, Math.max(TAMANHO_MIN, valor)));
  }

  const carregando = isLoading || isFetching;

  return (
    <div className="testes-pagina">
      {/* Área superior (sem scroll próprio): cabeçalho, controle de tamanho e
          seletor de cor. O conteúdo abaixo (fonte/ícones) tem scroll próprio,
          independente desta área — ver .testes-conteudo. */}
      <div className="testes-topo">
        <div className="testes-cabecalho">
          <h1>Ícones</h1>
          <p className="testes-subtitulo">
            Prévia de fonte e ícones em qualquer tamanho — sem precisar duplicar blocos por tamanho.
          </p>
        </div>

        <div className="testes-controle-tamanho">
          <label className="testes-tamanho-label">
            Tamanho
            <input
              type="range"
              min={TAMANHO_MIN}
              max={TAMANHO_MAX}
              value={tamanho}
              onChange={(e) => ajustarTamanho(Number(e.target.value))}
            />
            <input
              type="number"
              min={TAMANHO_MIN}
              max={TAMANHO_MAX}
              value={tamanho}
              onChange={(e) => ajustarTamanho(Number(e.target.value))}
              className="testes-tamanho-input"
            />
            px
            <button
              type="button"
              className={`btn-icone testes-refresh${carregando ? ' testes-refresh-carregando' : ''}`}
              onClick={recarregar}
              disabled={carregando}
              title={carregando ? 'Recarregando…' : 'Recarregar ícones'}
              aria-label={carregando ? 'Recarregando…' : 'Recarregar ícones'}
            >
              <IconeRefresh />
            </button>
          </label>
        </div>

        <section className="testes-secao testes-secao-cor">
          <h2>Cor do ícone</h2>
          <SeletorCor onCorChange={aplicarCor} />
        </section>
      </div>

      <div className="testes-conteudo" ref={conteudoRef}>
        <section className="testes-secao">
          <h2>Fonte — {tamanho}px</h2>
          <div className="testes-fonte-amostra" style={{ fontSize: tamanho }}>
            <p>Regular — O rato roeu a roupa do rei de Roma.</p>
            <p style={{ fontWeight: 600 }}>Negrito (600) — O rato roeu a roupa do rei de Roma.</p>
            <p style={{ fontStyle: 'italic' }}>Itálico — O rato roeu a roupa do rei de Roma.</p>
            <p className="testes-fonte-muted">Discreto (opacidade 0,7) — dicas e legendas.</p>
          </div>
        </section>

        <section className="testes-secao">
          <h2>Ícones (SVG) — {tamanho}px</h2>
          {erro && <p className="testes-erro">Não foi possível carregar os ícones: {erro}</p>}
          {!erro && !isLoading && icones.length === 0 && (
            <p className="hierarquia-vazio">Nenhum ícone encontrado na raiz do bucket.</p>
          )}
          <div className="testes-icones-grid">
            {icones.map((icone) => (
              <div key={icone.nome} className="testes-icone-item">
                {/* Ícone "pintado" via mask (não <img>) pra acompanhar a cor
                    escolhida no seletor — mesma técnica de IconeSupabase. */}
                <span
                  className="testes-icone-svg"
                  role="img"
                  aria-label={icone.nome}
                  style={{
                    width: tamanho,
                    height: tamanho,
                    WebkitMaskImage: `url(${icone.url})`,
                    maskImage: `url(${icone.url})`,
                  }}
                />
                <span className="testes-icone-nome">{icone.nome}</span>
              </div>
            ))}
          </div>
        </section>

        <section className="testes-secao">
          <h2>Ícones (PNG) — {tamanho}px</h2>
          {erro && <p className="testes-erro">Não foi possível carregar os ícones: {erro}</p>}
          {!erro && !isLoading && iconesPng.length === 0 && (
            <p className="hierarquia-vazio">Nenhum ícone encontrado na pasta PNG.</p>
          )}
          <div className="testes-icones-grid">
            {iconesPng.map((icone) => (
              <div key={icone.nome} className="testes-icone-item">
                {/* Aqui não pintamos com mask: o PNG mantém a cor original do
                    arquivo (não segue o tema), só o tamanho é ajustável —
                    mesma técnica de IconePng. */}
                <img
                  className="testes-icone-img"
                  src={icone.url}
                  alt={icone.nome}
                  width={tamanho}
                  height={tamanho}
                  style={{ width: tamanho, height: tamanho }}
                  loading="lazy"
                />
                <span className="testes-icone-nome">{icone.nome}</span>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}

/** Recarregar (botão de refresh) — SVG desenhado inline, sem depender de arquivo no bucket. */
function IconeRefresh() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M21 12a9 9 0 1 1-2.64-6.36" />
      <polyline points="21 3 21 9 15 9" />
    </svg>
  );
}
