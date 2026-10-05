import { Navigate, NavLink, Outlet, useParams } from 'react-router-dom';
import { NavAbas } from '../../components/NavAbas';
import { competenciaAtual, formatarCompetenciaExtenso, somarMeses } from '../../lib/datas';

const COMPETENCIA_RE = /^\d{4}-\d{2}$/;

function rotaFinancas(chave: string, competencia: string): string {
  const aba = chave.split(':')[1];
  return aba === 'resumo-geral' || aba === 'parcelamentos' ? `/financas/${aba}` : `/financas/${competencia}/${aba}`;
}

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
      <NavAbas grupo="financas" className="app-subnav" rota={(chave) => rotaFinancas(chave, competencia)} />
      <div className="app-subnav-conteudo">
        <Outlet />
      </div>
    </div>
  );
}
