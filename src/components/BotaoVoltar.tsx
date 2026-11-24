import { useLocation, useNavigate } from 'react-router-dom';
import { IconeFuncao } from './IconeUso';

/** Botão de voltar para a página anterior; sem página anterior (abriu direto), vai para o início de Finanças. */
export function BotaoVoltar({ fallback = '/financas' }: { fallback?: string }) {
  const navigate = useNavigate();
  const location = useLocation();

  function voltar() {
    // Chave "default" = primeira entrada do histórico: não há para onde voltar.
    if (location.key === 'default') navigate(fallback);
    else navigate(-1);
  }

  return (
    <div className="barra-voltar">
      <button type="button" className="btn-icone icone-uso-botao" onClick={voltar} title="Voltar" aria-label="Voltar">
        <IconeFuncao funcao="voltar" />
      </button>
    </div>
  );
}
