import { NavLink, Outlet } from 'react-router-dom';

export function SettingsLayout() {
  return (
    <div>
      <nav className="app-subnav">
        <NavLink to="/settings/categorias">Categorias</NavLink>
        <NavLink to="/settings/categorias-itens">Categorias de Itens</NavLink>
        <NavLink to="/settings/contas">Contas e Cartões</NavLink>
        <NavLink to="/settings/banco-lancamentos">Banco de Lançamentos</NavLink>
        <NavLink to="/settings/classificacoes-manutencao">Classificações de Manutenção</NavLink>
      </nav>
      <div className="app-subnav-conteudo">
        <Outlet />
      </div>
    </div>
  );
}
