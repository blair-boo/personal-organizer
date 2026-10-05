import { Outlet } from 'react-router-dom';
import { NavAbas } from '../../components/NavAbas';

export function DocumentosLayout() {
  return (
    <div>
      <NavAbas grupo="documentos" className="app-subnav" rota={(chave) => `/documentos/${chave.split(':')[1]}`} />
      <div className="app-subnav-conteudo">
        <Outlet />
      </div>
    </div>
  );
}
