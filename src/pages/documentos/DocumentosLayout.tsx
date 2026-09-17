import { NavLink, Outlet } from 'react-router-dom';

export function DocumentosLayout() {
  return (
    <div>
      <nav className="app-subnav">
        <NavLink to="/documentos/pessoais">Pessoais</NavLink>
        <NavLink to="/documentos/apartamento">Apartamento</NavLink>
        <NavLink to="/documentos/arquivo">Arquivo</NavLink>
        <NavLink to="/documentos/outros">Outros</NavLink>
      </nav>
      <div className="app-subnav-conteudo">
        <Outlet />
      </div>
    </div>
  );
}
