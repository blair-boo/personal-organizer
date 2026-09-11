import { Navigate, NavLink, Outlet, useParams } from 'react-router-dom';
import { competenciaAtual, formatarCompetenciaExtenso, somarMeses } from '../../lib/datas';

const COMPETENCIA_RE = /^\d{4}-\d{2}$/;

export function FinancasLayout() {
  const { competencia } = useParams<{ competencia: string }>();

  if (!competencia || !COMPETENCIA_RE.test(competencia)) {
    return <Navigate to={`/financas/${competenciaAtual()}/resumo`} replace />;
  }

  return (
    <div className="financas-layout">
      <div className="mes-seletor">
        <NavLink to={`/financas/${somarMeses(competencia, -1)}/resumo`} className="mes-seletor-botao" aria-label="Mês anterior">
          ‹
        </NavLink>
        <span className="mes-seletor-atual">{formatarCompetenciaExtenso(competencia)}</span>
        <NavLink to={`/financas/${somarMeses(competencia, 1)}/resumo`} className="mes-seletor-botao" aria-label="Próximo mês">
          ›
        </NavLink>
      </div>
      <nav className="app-subnav">
        <NavLink to={`/financas/${competencia}/conta-corrente`}>Conta Corrente</NavLink>
        <NavLink to={`/financas/${competencia}/cartao-credito`}>Cartão de Crédito</NavLink>
        <NavLink to={`/financas/${competencia}/resumo`}>Resumo do Mês</NavLink>
        <NavLink to="/financas/resumo-geral">Resumo Geral</NavLink>
        <NavLink to="/financas/parcelamentos">Parcelamentos</NavLink>
      </nav>
      <div className="app-subnav-conteudo">
        <Outlet />
      </div>
    </div>
  );
}
