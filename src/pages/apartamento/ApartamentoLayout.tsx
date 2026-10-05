import { Outlet } from 'react-router-dom';
import { NavAbas } from '../../components/NavAbas';

export function ApartamentoLayout() {
  return (
    <div>
      <NavAbas grupo="apartamento" className="app-subnav" rota={(chave) => `/apartamento/${chave.split(':')[1]}`} />
      <div className="app-subnav-conteudo">
        <Outlet />
      </div>
    </div>
  );
}
