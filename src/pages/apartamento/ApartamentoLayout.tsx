import { NavLink, Outlet } from 'react-router-dom';

export function ApartamentoLayout() {
  return (
    <div>
      <nav className="app-subnav">
        <NavLink to="/apartamento/itens">Itens</NavLink>
        <NavLink to="/apartamento/projetos">Projetos</NavLink>
        <NavLink to="/apartamento/manutencao">Manutenção</NavLink>
      </nav>
      <div className="app-subnav-conteudo">
        <Outlet />
      </div>
    </div>
  );
}
