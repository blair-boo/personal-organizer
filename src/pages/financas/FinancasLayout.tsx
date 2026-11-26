import { Navigate, NavLink, Outlet, useParams } from 'react-router-dom';
import { NavAbas } from '../../components/NavAbas';
import { SeletorEscopoFinancas } from '../../components/SeletorEscopoFinancas';
import { useEscopoFinancas } from '../../hooks/useEscopoFinancas';
import { competenciaAtual, formatarCompetenciaExtenso, somarMeses } from '../../lib/datas';

const COMPETENCIA_RE = /^\d{4}-\d{2}$/;

function rotaFinancas(chave: string, competencia: string): string {
  const aba = chave.split(':')[1];
  return aba === 'resumo-geral' || aba === 'parcelamentos' ? `/financas/${aba}` : `/financas/${competencia}/${aba}`;
}

export function FinancasLayout() {
  const { competencia } = useParams<{ competencia: string }>();
  const { caminho } = useEscopoFinancas();

  if (!competencia || !COMPETENCIA_RE.test(competencia)) {
    return <Navigate to={caminho(`/financas/${competenciaAtual()}/resumo`)} replace />;
  }

  return (
    <div className="financas-layout">
      <SeletorEscopoFinancas />
      <div className="mes-seletor">
        <NavLink to={caminho(`/financas/${somarMeses(competencia, -1)}/resumo`)} className="mes-seletor-botao" aria-label="Mês anterior">
          ‹
        </NavLink>
        <span className="mes-seletor-atual">{formatarCompetenciaExtenso(competencia)}</span>
        <NavLink to={caminho(`/financas/${somarMeses(competencia, 1)}/resumo`)} className="mes-seletor-botao" aria-label="Próximo mês">
          ›
        </NavLink>
      </div>
      <NavAbas grupo="financas" className="app-subnav" rota={(chave) => caminho(rotaFinancas(chave, competencia))} />
      <div className="app-subnav-conteudo">
        <Outlet />
      </div>
    </div>
  );
}
