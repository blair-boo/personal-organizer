import { NavLink, Outlet } from 'react-router-dom';

export function SettingsLayout() {
  return (
    <div>
      <nav className="app-subnav">
        <NavLink to="/settings/categorias">Categorias</NavLink>
        <NavLink to="/settings/tags-itens">Tags de Itens</NavLink>
        <NavLink to="/settings/contas">Contas e Cartões</NavLink>
        <NavLink to="/settings/banco-lancamentos">Banco de Lançamentos</NavLink>
        <NavLink to="/settings/classificacoes-tarefas">Classificações de Tarefas</NavLink>
      </nav>
      <div className="app-subnav-conteudo">
        <Outlet />
      </div>
    </div>
  );
}
